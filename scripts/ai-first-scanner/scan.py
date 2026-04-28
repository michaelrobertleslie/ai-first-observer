#!/usr/bin/env python3
"""
AI-First Observer — Bitbucket Repo Scanner

Walks a list of Bitbucket repositories, extracts context-engineering signals
(presence of main instruction file, rules files, skills, MCP config, anti-patterns,
self-healing, champion activity), classifies maturity, and emits Dynatrace bizevents.

Usage:
    python scan.py --config repos.yaml --emit
    python scan.py --config repos.yaml --dry-run     # print events, do not send
    python scan.py --config repos.yaml --repo APPS/papa-tools  # single repo

Auth:
    BITBUCKET_BASE_URL    e.g. https://bitbucket.lab.dynatrace.org/rest/api/1.0
    BITBUCKET_PAT         personal access token (or in macOS Keychain under bitbucket-pat)
    DT_INGEST_URL         e.g. https://<env>.live.dynatrace.com/api/v2/bizevents/ingest
    DT_INGEST_TOKEN       API token with bizevents.ingest scope

The script is idempotent. Run nightly via cron or a Workflow.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import requests
import yaml


# ─────────────────────────────────────────────────────────────────────
# Config & auth
# ─────────────────────────────────────────────────────────────────────

BITBUCKET_BASE_URL = os.environ.get(
    "BITBUCKET_BASE_URL",
    "https://bitbucket.lab.dynatrace.org/rest/api/1.0",
)
DT_INGEST_URL = os.environ.get("DT_INGEST_URL", "")
DT_INGEST_TOKEN = os.environ.get("DT_INGEST_TOKEN", "")


def bitbucket_pat() -> str:
    """Resolve PAT from env or macOS Keychain."""
    pat = os.environ.get("BITBUCKET_PAT")
    if pat:
        return pat
    try:
        out = subprocess.check_output(
            ["security", "find-generic-password", "-s", "bitbucket-pat", "-w"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return out.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        sys.exit("BITBUCKET_PAT not set and no Keychain entry found.")


# ─────────────────────────────────────────────────────────────────────
# Signal definitions
# ─────────────────────────────────────────────────────────────────────

MAIN_FILE_CANDIDATES = [
    "CLAUDE.md",
    "AGENTS.md",
    ".github/copilot-instructions.md",
]

RULES_DIR_CANDIDATES = [
    ".claude/rules",
    ".github/instructions",
    ".cursor/rules",
]

SKILLS_DIR_CANDIDATES = [
    ".agents/skills",
    ".claude/skills",
]

MCP_CONFIG_CANDIDATES = [
    ".mcp.json",
    ".vscode/mcp.json",
    ".claude/mcp.json",
]

ANTI_PATTERN_REGEX = re.compile(
    r"\b(do\s*not|never|avoid|don't|forbidden|banned)\b",
    re.IGNORECASE,
)

SELF_HEALING_MARKERS = [
    "flag the discrepancy",
    "self-healing",
    "contradicts these instructions",
    "if you encounter a pattern",
]

AI_COMMIT_MARKERS = [
    "Co-authored-by: Claude",
    "Co-authored-by: GitHub Copilot",
    "Co-authored-by: Cursor",
    "🤖 Generated with",
    "[AI]",
    "[ai-generated]",
    "[copilot]",
    "[claude]",
]

AI_BRANCH_PATTERNS = [
    re.compile(r"^copilot/", re.IGNORECASE),
    re.compile(r"^ai/", re.IGNORECASE),
    re.compile(r"^claude/", re.IGNORECASE),
    re.compile(r"-ai-", re.IGNORECASE),
]

DEFAULT_MAIN_TOKEN_BUDGET = 2500
DEFAULT_PR_WINDOW_DAYS = 14


@dataclass
class CapabilityConfig:
    """Per-capability thresholds and detection markers loaded from repos.yaml."""

    name: str
    repos: list[str]
    main_token_budget: int = DEFAULT_MAIN_TOKEN_BUDGET
    pr_window_days: int = DEFAULT_PR_WINDOW_DAYS
    pass_rate_target: float = 70.0
    score_target: int = 60
    ai_co_author_markers: list[str] = field(default_factory=lambda: list(AI_COMMIT_MARKERS))
    ai_branch_patterns: list[re.Pattern] = field(default_factory=lambda: list(AI_BRANCH_PATTERNS))


def load_capability_configs(cfg: dict) -> list[CapabilityConfig]:
    """Merge `defaults:` with each capability block to produce concrete configs."""
    defaults = cfg.get("defaults") or {}
    out: list[CapabilityConfig] = []
    for cap in cfg.get("capabilities") or []:
        markers = cap.get("ai_co_author_markers") or defaults.get("ai_co_author_markers") or AI_COMMIT_MARKERS
        patterns = cap.get("ai_branch_patterns") or defaults.get("ai_branch_patterns") or [p.pattern for p in AI_BRANCH_PATTERNS]
        out.append(
            CapabilityConfig(
                name=cap["name"],
                repos=list(cap.get("repos") or []),
                main_token_budget=int(cap.get("main_token_budget") or defaults.get("main_token_budget") or DEFAULT_MAIN_TOKEN_BUDGET),
                pr_window_days=int(cap.get("pr_window_days") or defaults.get("pr_window_days") or DEFAULT_PR_WINDOW_DAYS),
                pass_rate_target=float(cap.get("pass_rate_target") or defaults.get("pass_rate_target") or 70),
                score_target=int(cap.get("score_target") or defaults.get("score_target") or 60),
                ai_co_author_markers=list(markers),
                ai_branch_patterns=[re.compile(p, re.IGNORECASE) for p in patterns],
            )
        )
    return out


# ─────────────────────────────────────────────────────────────────────
# Bitbucket client
# ─────────────────────────────────────────────────────────────────────


class Bitbucket:
    def __init__(self, base_url: str, pat: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {pat}",
                "Accept": "application/json",
            }
        )

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        url = f"{self.base_url}{path}"
        r = self.session.get(url, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def _get_raw(self, path: str, params: Optional[dict] = None) -> Optional[str]:
        url = f"{self.base_url}{path}"
        r = self.session.get(url, params=params, timeout=30)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.text

    def file_exists(self, project: str, repo: str, path: str) -> bool:
        return (
            self._get_raw(f"/projects/{project}/repos/{repo}/raw/{path}") is not None
        )

    def file_content(self, project: str, repo: str, path: str) -> Optional[str]:
        return self._get_raw(f"/projects/{project}/repos/{repo}/raw/{path}")

    def list_dir(self, project: str, repo: str, path: str) -> list[str]:
        """Return list of file paths under a directory, recursively (one level deep)."""
        try:
            data = self._get(
                f"/projects/{project}/repos/{repo}/files/{path}",
                params={"limit": 100},
            )
            return data.get("values", [])
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                return []
            raise

    def last_commit(self, project: str, repo: str, path: str = "") -> Optional[dict]:
        """Get the most recent commit on default branch (optionally filtered by path)."""
        try:
            params = {"limit": 1}
            if path:
                params["path"] = path
            data = self._get(
                f"/projects/{project}/repos/{repo}/commits", params=params
            )
            values = data.get("values", [])
            return values[0] if values else None
        except requests.HTTPError:
            return None

    def commits_in_window(
        self, project: str, repo: str, path: str, days: int = 90
    ) -> list[dict]:
        try:
            data = self._get(
                f"/projects/{project}/repos/{repo}/commits",
                params={"limit": 200, "path": path},
            )
            cutoff_ms = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp() * 1000)
            return [c for c in data.get("values", []) if c.get("committerTimestamp", 0) >= cutoff_ms]
        except requests.HTTPError:
            return []

    def merged_prs(self, project: str, repo: str, days: int = 30) -> list[dict]:
        all_prs: list[dict] = []
        cutoff_ms = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp() * 1000)
        start = 0
        while True:
            data = self._get(
                f"/projects/{project}/repos/{repo}/pull-requests",
                params={"state": "MERGED", "limit": 100, "start": start, "order": "NEWEST"},
            )
            values = data.get("values", [])
            if not values:
                break
            keep = [pr for pr in values if pr.get("closedDate", 0) >= cutoff_ms]
            all_prs.extend(keep)
            if len(keep) < len(values) or data.get("isLastPage", True):
                break
            start = data.get("nextPageStart", start + 100)
        return all_prs

    def pr_activities(self, project: str, repo: str, pr_id: int) -> list[dict]:
        all_acts: list[dict] = []
        start = 0
        while True:
            data = self._get(
                f"/projects/{project}/repos/{repo}/pull-requests/{pr_id}/activities",
                params={"limit": 100, "start": start},
            )
            values = data.get("values", [])
            all_acts.extend(values)
            if data.get("isLastPage", True) or not values:
                break
            start = data.get("nextPageStart", start + 100)
        return all_acts


# ─────────────────────────────────────────────────────────────────────
# Scan logic
# ─────────────────────────────────────────────────────────────────────


@dataclass
class RepoScanResult:
    capability: str
    project: str
    slug: str
    name: str
    url: str
    last_commit_date: Optional[str] = None
    last_commit_age_days: Optional[int] = None

    main_file_present: bool = False
    main_file_path: Optional[str] = None
    main_file_tokens: int = 0
    main_file_last_modified: Optional[str] = None
    main_file_age_days: Optional[int] = None
    main_file_hash: Optional[str] = None

    rules_dir_present: bool = False
    rules_files_count: int = 0
    rules_files_total_tokens: int = 0

    skills_count: int = 0

    anti_pattern_count: int = 0
    self_healing_present: bool = False

    mcp_config_present: bool = False
    mcp_servers_count: int = 0

    maturity_tier: str = "none"
    maturity_score: int = 0

    failure_bloat: bool = False
    failure_staleness: bool = False
    failure_missing_self_healing: bool = False
    failure_vagueness: bool = False
    failure_copy_paste: bool = False

    champion_last_author: Optional[str] = None
    champion_touches_90d: int = 0
    champion_unique_authors_90d: int = 0


def estimate_tokens(text: str) -> int:
    return len(text) // 4


def days_ago_from_ms(ts_ms: int) -> int:
    dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    return (datetime.now(timezone.utc) - dt).days


def scan_repo(bb: Bitbucket, cap_cfg: CapabilityConfig, project: str, slug: str) -> RepoScanResult:
    name = slug
    url = f"{bb.base_url.replace('/rest/api/1.0', '')}/projects/{project}/repos/{slug}"
    result = RepoScanResult(
        capability=cap_cfg.name,
        project=project,
        slug=slug,
        name=name,
        url=url,
    )

    # Last commit on repo
    last_commit = bb.last_commit(project, slug)
    if last_commit:
        ts_ms = last_commit.get("committerTimestamp", 0)
        result.last_commit_date = datetime.fromtimestamp(
            ts_ms / 1000, tz=timezone.utc
        ).isoformat()
        result.last_commit_age_days = days_ago_from_ms(ts_ms)

    # Main file detection
    context_paths_for_champion: list[str] = []
    main_text: Optional[str] = None
    for candidate in MAIN_FILE_CANDIDATES:
        text = bb.file_content(project, slug, candidate)
        if text is not None:
            result.main_file_present = True
            result.main_file_path = candidate
            result.main_file_tokens = estimate_tokens(text)
            result.main_file_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            main_text = text
            commit = bb.last_commit(project, slug, candidate)
            if commit:
                ts_ms = commit.get("committerTimestamp", 0)
                result.main_file_last_modified = datetime.fromtimestamp(
                    ts_ms / 1000, tz=timezone.utc
                ).isoformat()
                result.main_file_age_days = days_ago_from_ms(ts_ms)
            context_paths_for_champion.append(candidate)
            break

    # Rules dir detection
    all_rules_text = ""
    for rules_dir in RULES_DIR_CANDIDATES:
        files = bb.list_dir(project, slug, rules_dir)
        rule_files = [f for f in files if isinstance(f, str) and f.endswith((".md", ".instructions.md"))]
        if rule_files:
            result.rules_dir_present = True
            result.rules_files_count += len(rule_files)
            for rf in rule_files:
                content = bb.file_content(project, slug, f"{rules_dir}/{rf}")
                if content:
                    result.rules_files_total_tokens += estimate_tokens(content)
                    all_rules_text += "\n" + content
            context_paths_for_champion.append(rules_dir)

    # Skills
    for skills_dir in SKILLS_DIR_CANDIDATES:
        files = bb.list_dir(project, slug, skills_dir)
        skill_files = [f for f in files if isinstance(f, str)]
        if skill_files:
            result.skills_count += len(skill_files)
            context_paths_for_champion.append(skills_dir)

    # MCP
    for mcp_path in MCP_CONFIG_CANDIDATES:
        text = bb.file_content(project, slug, mcp_path)
        if text:
            result.mcp_config_present = True
            try:
                cfg = json.loads(text)
                servers = cfg.get("servers") or cfg.get("mcpServers") or {}
                result.mcp_servers_count = len(servers) if isinstance(servers, dict) else 0
            except json.JSONDecodeError:
                pass
            break

    # Anti-pattern density (across main + rules)
    combined = (main_text or "") + "\n" + all_rules_text
    if combined.strip():
        result.anti_pattern_count = len(ANTI_PATTERN_REGEX.findall(combined))
        lower = combined.lower()
        result.self_healing_present = any(m.lower() in lower for m in SELF_HEALING_MARKERS)

    # Maturity tier
    if not result.main_file_present:
        result.maturity_tier = "none"
    elif result.mcp_config_present and result.skills_count > 0 and result.rules_files_count > 0:
        result.maturity_tier = "full_stack"
    elif result.skills_count > 0 and result.rules_files_count > 0:
        result.maturity_tier = "two_tier_skills"
    elif result.rules_files_count > 0:
        result.maturity_tier = "two_tier"
    else:
        result.maturity_tier = "main_only"

    # Maturity score
    score = 0
    if result.main_file_present:
        score += 20
    if result.main_file_present and result.main_file_tokens <= cap_cfg.main_token_budget:
        score += 10
    if result.self_healing_present:
        score += 10
    if result.anti_pattern_count >= 5:
        score += 15
    if result.rules_files_count >= 2:
        score += 15
    if result.skills_count >= 1:
        score += 10
    if result.mcp_config_present:
        score += 10
    if result.main_file_age_days is not None and result.main_file_age_days < 60:
        score += 10
    result.maturity_score = score

    # Failure flags
    result.failure_bloat = result.main_file_tokens > cap_cfg.main_token_budget
    result.failure_staleness = (
        result.main_file_present
        and (result.main_file_age_days or 0) > 90
        and (result.last_commit_age_days or 999) < 30
    )
    result.failure_missing_self_healing = (
        result.main_file_present and not result.self_healing_present
    )
    result.failure_vagueness = (
        result.main_file_present
        and result.anti_pattern_count < 3
        and result.main_file_tokens > 500
    )

    # Champion activity
    authors_90d: set[str] = set()
    touches = 0
    last_author: Optional[tuple[int, str]] = None
    for path in context_paths_for_champion:
        commits = bb.commits_in_window(project, slug, path, days=90)
        touches += len(commits)
        for c in commits:
            author = c.get("author", {}).get("emailAddress") or c.get("author", {}).get("name")
            if author:
                authors_90d.add(author)
                ts = c.get("committerTimestamp", 0)
                if last_author is None or ts > last_author[0]:
                    last_author = (ts, author)
    result.champion_touches_90d = touches
    result.champion_unique_authors_90d = len(authors_90d)
    if last_author:
        result.champion_last_author = last_author[1]

    return result


# ─────────────────────────────────────────────────────────────────────
# PR scan
# ─────────────────────────────────────────────────────────────────────


def detect_ai_signals(
    pr: dict,
    activities: list[dict],
    cap_cfg: CapabilityConfig,
) -> list[str]:
    signals: list[str] = []
    title = (pr.get("title") or "").lower()
    description = (pr.get("description") or "")
    branch = (pr.get("fromRef", {}).get("displayId") or "")

    if any(p.search(branch) for p in cap_cfg.ai_branch_patterns):
        signals.append("ai_branch_name")

    for marker in cap_cfg.ai_co_author_markers:
        if marker.lower() in description.lower():
            signals.append(f"description:{marker.strip()[:30]}")
            break

    # Activities can contain commit messages (added on push)
    for act in activities:
        commit = act.get("commit", {})
        msg = (commit.get("message") or "")
        for marker in cap_cfg.ai_co_author_markers:
            if marker.lower() in msg.lower():
                signals.append(f"commit:{marker.strip()[:30]}")
                return signals
    if "[ai]" in title or "ai-generated" in title:
        signals.append("ai_in_title")
    return signals


def scan_pr(
    bb: Bitbucket,
    cap_cfg: CapabilityConfig,
    project: str,
    slug: str,
    pr: dict,
) -> dict:
    activities = bb.pr_activities(project, slug, pr["id"])
    signals = detect_ai_signals(pr, activities, cap_cfg)

    needs_work_count = 0
    comment_count = 0
    for act in activities:
        action = act.get("action")
        if action == "REVIEWED" and act.get("commentAction") is None:
            # reviewer state change
            review = act.get("review", {}) or {}
            if review.get("status") == "NEEDS_WORK":
                needs_work_count += 1
        if action == "COMMENTED":
            comment_count += 1

    created_ms = pr.get("createdDate", 0)
    merged_ms = pr.get("closedDate", 0)
    ttm_hours = (merged_ms - created_ms) / 1000 / 3600 if (merged_ms and created_ms) else 0.0

    author = (pr.get("author", {}) or {}).get("user", {}) or {}

    return {
        "event.type": "ai_first.pr_event",
        "event.provider": "ai-first-scanner",
        "capability": cap_cfg.name,
        "repo.project": project,
        "repo.slug": slug,
        "pr.id": pr.get("id"),
        "pr.title": pr.get("title"),
        "pr.url": (pr.get("links", {}).get("self") or [{}])[0].get("href"),
        "pr.author": author.get("emailAddress") or author.get("name"),
        "pr.is_ai_assisted": bool(signals),
        "pr.ai_signals": signals,
        "pr.comment_count": comment_count,
        "pr.review_rounds": needs_work_count,
        "pr.first_attempt_pass": needs_work_count == 0,
        "pr.created": datetime.fromtimestamp(created_ms / 1000, tz=timezone.utc).isoformat()
        if created_ms
        else None,
        "pr.merged": datetime.fromtimestamp(merged_ms / 1000, tz=timezone.utc).isoformat()
        if merged_ms
        else None,
        "pr.time_to_merge_hours": round(ttm_hours, 2),
    }


# ─────────────────────────────────────────────────────────────────────
# Bizevent emit
# ─────────────────────────────────────────────────────────────────────


def repo_result_to_event(r: RepoScanResult) -> dict:
    return {
        "event.type": "ai_first.repo_scan",
        "event.provider": "ai-first-scanner",
        "capability": r.capability,
        "repo.project": r.project,
        "repo.slug": r.slug,
        "repo.name": r.name,
        "repo.url": r.url,
        "repo.last_commit_date": r.last_commit_date,
        "repo.last_commit_age_days": r.last_commit_age_days,
        "context.main_file_present": r.main_file_present,
        "context.main_file_path": r.main_file_path,
        "context.main_file_tokens": r.main_file_tokens,
        "context.main_file_last_modified": r.main_file_last_modified,
        "context.main_file_age_days": r.main_file_age_days,
        "context.main_file_hash": r.main_file_hash,
        "context.rules_dir_present": r.rules_dir_present,
        "context.rules_files_count": r.rules_files_count,
        "context.rules_files_total_tokens": r.rules_files_total_tokens,
        "context.skills_count": r.skills_count,
        "context.anti_pattern_count": r.anti_pattern_count,
        "context.self_healing_present": r.self_healing_present,
        "context.mcp_config_present": r.mcp_config_present,
        "context.mcp_servers_count": r.mcp_servers_count,
        "maturity.tier": r.maturity_tier,
        "maturity.score": r.maturity_score,
        "failure.bloat": r.failure_bloat,
        "failure.staleness": r.failure_staleness,
        "failure.missing_self_healing": r.failure_missing_self_healing,
        "failure.vagueness": r.failure_vagueness,
        "failure.copy_paste": r.failure_copy_paste,
        "champion.last_author": r.champion_last_author,
        "champion.touches_90d": r.champion_touches_90d,
        "champion.unique_authors_90d": r.champion_unique_authors_90d,
    }


def emit_events(events: list[dict]) -> None:
    if not DT_INGEST_URL or not DT_INGEST_TOKEN:
        sys.exit("DT_INGEST_URL and DT_INGEST_TOKEN must be set to emit.")
    headers = {
        "Authorization": f"Api-Token {DT_INGEST_TOKEN}",
        "Content-Type": "application/json",
    }
    # Batched in chunks of 100
    for i in range(0, len(events), 100):
        chunk = events[i : i + 100]
        r = requests.post(DT_INGEST_URL, headers=headers, json=chunk, timeout=60)
        r.raise_for_status()
        print(f"Emitted batch of {len(chunk)} events.")


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────


def detect_copy_paste(events: list[dict]) -> None:
    by_hash: dict[str, list[dict]] = {}
    for e in events:
        if e.get("event.type") != "ai_first.repo_scan":
            continue
        h = e.get("context.main_file_hash")
        if h:
            by_hash.setdefault(h, []).append(e)
    for group in by_hash.values():
        if len(group) > 1:
            for e in group:
                e["failure.copy_paste"] = True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="repos.yaml path")
    parser.add_argument("--repo", help="Scan a single repo, format PROJECT/SLUG")
    parser.add_argument("--capability", help="Restrict to a single capability by name")
    parser.add_argument("--dry-run", action="store_true", help="Print events, do not emit")
    parser.add_argument("--emit", action="store_true", help="Emit events to Dynatrace")
    parser.add_argument(
        "--pr-days",
        type=int,
        default=None,
        help="Override per-capability PR window (days). Default: per-capability value from repos.yaml",
    )
    parser.add_argument("--no-prs", action="store_true", help="Skip PR scanning")
    args = parser.parse_args()

    cfg = yaml.safe_load(Path(args.config).read_text())
    cap_configs = load_capability_configs(cfg)
    if args.capability:
        cap_configs = [c for c in cap_configs if c.name == args.capability]
        if not cap_configs:
            sys.exit(f"No capability named {args.capability!r} in {args.config}")

    bb = Bitbucket(BITBUCKET_BASE_URL, bitbucket_pat())

    # (cap_cfg, project, slug)
    work: list[tuple[CapabilityConfig, str, str]] = []
    for cap_cfg in cap_configs:
        for r in cap_cfg.repos:
            project, slug = r.split("/", 1)
            if args.repo and f"{project}/{slug}" != args.repo:
                continue
            work.append((cap_cfg, project, slug))

    if not work:
        sys.exit("No repos to scan (check --config / --capability / --repo).")

    all_events: list[dict] = []

    print(f"Scanning {len(work)} repos...", file=sys.stderr)
    for cap_cfg, project, slug in work:
        print(f"  {project}/{slug} ({cap_cfg.name})", file=sys.stderr)
        try:
            result = scan_repo(bb, cap_cfg, project, slug)
            all_events.append(repo_result_to_event(result))
        except Exception as e:
            print(f"    ERROR: {e}", file=sys.stderr)
            continue

        if not args.no_prs:
            window_days = args.pr_days if args.pr_days is not None else cap_cfg.pr_window_days
            try:
                prs = bb.merged_prs(project, slug, days=window_days)
                for pr in prs:
                    all_events.append(scan_pr(bb, cap_cfg, project, slug, pr))
            except Exception as e:
                print(f"    PR scan ERROR: {e}", file=sys.stderr)

    detect_copy_paste(all_events)

    if args.dry_run:
        print(json.dumps(all_events, indent=2, default=str))
        return

    if args.emit:
        emit_events(all_events)
    else:
        print(json.dumps(all_events, indent=2, default=str))
        print(
            "\nUse --emit to send to Dynatrace, or --dry-run to suppress this message.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
