#!/usr/bin/env python3
"""
AI-First Observer — Juno (Backstage catalog) repo discovery.

Queries Juno's catalog API to enumerate Bitbucket repositories belonging to
each configured capability, and writes them into repos.yaml.

Usage:
    # Refresh repos.yaml in place (preserves capability list and overrides):
    python discover.py --config repos.yaml --update

    # Print what it would find for one capability:
    python discover.py --capability platform-apps-papa --dry-run

Auth:
    JUNO_BASE_URL   default https://juno.internal.dynatrace.com
    JUNO_TOKEN      Backstage bearer token (or in macOS Keychain as `juno-token`)

The script is conservative: it only changes the `repos:` list of capabilities
that have `juno.discover: true` in repos.yaml. Capabilities with explicit
`repos:` and no `juno.discover` flag are left untouched.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

import requests
import yaml

JUNO_BASE_URL = os.environ.get("JUNO_BASE_URL", "https://juno.internal.dynatrace.com").rstrip("/")


def juno_token() -> str:
    tok = os.environ.get("JUNO_TOKEN")
    if tok:
        return tok
    try:
        out = subprocess.check_output(
            ["security", "find-generic-password", "-s", "juno-token", "-w"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return out.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        sys.exit(
            "JUNO_TOKEN not set and no Keychain entry. "
            "Create one with: security add-generic-password -s juno-token -a $USER -w '<token>'"
        )


# Bitbucket source-location annotation looks like:
#   url:https://bitbucket.lab.dynatrace.org/projects/APPS/repos/dashboards
#   url:https://bitbucket.lab.dynatrace.org/scm/APPS/dashboards.git
SOURCE_LOC_RE = re.compile(
    r"bitbucket\.lab\.dynatrace\.org/(?:projects/([A-Z0-9]+)/repos/([A-Za-z0-9._-]+)|scm/([A-Z0-9]+)/([A-Za-z0-9._-]+?)(?:\.git)?)",
    re.IGNORECASE,
)


def parse_bitbucket_path(annotation_value: str) -> Optional[str]:
    if not annotation_value:
        return None
    m = SOURCE_LOC_RE.search(annotation_value)
    if not m:
        return None
    project = (m.group(1) or m.group(3) or "").upper()
    slug = m.group(2) or m.group(4) or ""
    if not project or not slug:
        return None
    return f"{project}/{slug}"


class Juno:
    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            }
        )

    def entities(self, catalog_filter: str, fields: Optional[list[str]] = None) -> list[dict]:
        """GET /api/catalog/entities with a single filter expression."""
        params: list[tuple[str, str]] = [("filter", catalog_filter)]
        if fields:
            params.append(("fields", ",".join(fields)))
        url = f"{self.base_url}/api/catalog/entities"
        r = self.session.get(url, params=params, timeout=60)
        r.raise_for_status()
        return r.json()

    def teams_for_capability(self, capability_slug: str) -> list[str]:
        """List of group/team metadata.name values that have spec.capability == slug."""
        try:
            entities = self.entities(
                f"kind=group,spec.capability={capability_slug}",
                fields=["metadata.name", "spec.capability"],
            )
        except requests.HTTPError as e:
            print(f"  warn: groups for {capability_slug!r} → HTTP {e.response.status_code}", file=sys.stderr)
            return []
        return sorted({e.get("metadata", {}).get("name") for e in entities if e.get("metadata", {}).get("name")})

    def repos_for_team(self, team_name: str) -> list[str]:
        """Bitbucket repo paths for components owned by `default/<team_name>`."""
        # Component owners often disagree slightly with the group's metadata.name
        # (e.g. team-onion-appshell vs team-onion-app-shell). Try common variants.
        variants = {team_name}
        # Hyphenate / dehyphenate trailing -appshell ↔ -app-shell etc.
        if "appshell" in team_name:
            variants.add(team_name.replace("appshell", "app-shell"))
        if "-app-shell" in team_name:
            variants.add(team_name.replace("-app-shell", "appshell"))
        if team_name.startswith("team-the-"):
            variants.add(team_name.replace("team-the-", "team-"))
        # Strip trailing -<numeric-id>-... suffix if present (team-holwei-127258 → team-holwei)
        m = re.match(r"^(team-[a-z]+)-\d+$", team_name)
        if m:
            variants.add(m.group(1))
        seen: set[str] = set()
        for v in variants:
            try:
                entities = self.entities(
                    f"kind=component,spec.owner=default/{v}",
                    fields=["metadata.annotations", "spec.owner"],
                )
            except requests.HTTPError as e:
                print(f"    warn: components for {v!r} → HTTP {e.response.status_code}", file=sys.stderr)
                continue
            for e in entities:
                ann = (e.get("metadata") or {}).get("annotations") or {}
                src = ann.get("backstage.io/source-location") or ann.get("backstage.io/managed-by-location") or ""
                path = parse_bitbucket_path(src)
                if path:
                    seen.add(path)
        return sorted(seen)

    def repos_for_capability(self, capability_slug: str) -> list[str]:
        """
        Return a sorted, deduplicated list of `PROJECT/slug` repo paths for the
        given capability slug (e.g. `platform-apps-papa`).

        Strategy:
        1. Find all Group entities with `spec.capability` == slug.
        2. For each group, query Components with `spec.owner == default/<team>`.
        3. Pull `backstage.io/source-location` and parse Bitbucket project/slug.
        """
        teams = self.teams_for_capability(capability_slug)
        if not teams:
            print(f"  warn: no teams found for capability {capability_slug!r}", file=sys.stderr)
            return []
        seen: set[str] = set()
        for team in teams:
            seen.update(self.repos_for_team(team))
        return sorted(seen)


def update_yaml(path: Path, juno: Juno) -> None:
    cfg = yaml.safe_load(path.read_text()) or {}
    caps = cfg.get("capabilities") or []
    changed = 0
    for cap in caps:
        discover = (cap.get("juno") or {}).get("discover") is True
        slug = (cap.get("juno") or {}).get("slug") or ""
        if not discover:
            continue
        if not slug:
            print(f"  skip {cap.get('name')!r}: juno.discover=true but no juno.slug", file=sys.stderr)
            continue
        print(f"  discovering {cap['name']!r} via Juno slug {slug!r}...", file=sys.stderr)
        repos = juno.repos_for_capability(slug)
        existing = set(cap.get("repos") or [])
        # Preserve any manually-pinned repos via `juno.extra_repos`
        extra = (cap.get("juno") or {}).get("extra_repos") or []
        combined = sorted(set(repos) | set(extra))
        if set(combined) != existing:
            cap["repos"] = combined
            changed += 1
            print(f"    {len(combined)} repos ({len(existing)} previously)", file=sys.stderr)
        else:
            print(f"    no change ({len(combined)} repos)", file=sys.stderr)
    if changed:
        path.write_text(yaml.safe_dump(cfg, sort_keys=False, default_flow_style=False))
        print(f"Updated {changed} capability blocks in {path}", file=sys.stderr)
    else:
        print("No changes.", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", help="repos.yaml path")
    parser.add_argument("--capability", help="Single capability slug to discover (dry-run only)")
    parser.add_argument("--update", action="store_true", help="Rewrite repos.yaml in place")
    parser.add_argument("--dry-run", action="store_true", help="Print discovered repos, do not modify")
    args = parser.parse_args()

    juno = Juno(JUNO_BASE_URL, juno_token())

    if args.capability:
        repos = juno.repos_for_capability(args.capability)
        for r in repos:
            print(r)
        return

    if not args.config:
        sys.exit("--config repos.yaml is required (or use --capability for ad-hoc lookup).")

    path = Path(args.config)
    if args.update:
        update_yaml(path, juno)
    else:
        # Dry-run: show what would change without writing.
        cfg = yaml.safe_load(path.read_text()) or {}
        for cap in cfg.get("capabilities") or []:
            j = cap.get("juno") or {}
            if not j.get("discover"):
                continue
            slug = j.get("slug")
            print(f"\n# {cap['name']} (slug={slug})")
            if not slug:
                print("  (skipped — no juno.slug)")
                continue
            for r in juno.repos_for_capability(slug):
                print(f"  - {r}")


if __name__ == "__main__":
    main()
