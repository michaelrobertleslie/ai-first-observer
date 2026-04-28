# AI-First Scanner

Walks Bitbucket repositories, extracts context-engineering signals, and emits
Dynatrace bizevents that drive the AI-First Adoption pillar in the AI-First
Observer app.

## Setup

```bash
pip install -r requirements.txt
```

Environment:

```bash
# Required for emit
export DT_INGEST_URL="https://<env>.live.dynatrace.com/api/v2/bizevents/ingest"
export DT_INGEST_TOKEN="dt0c01.<api token with bizevents.ingest>"

# Optional (defaults to lab Bitbucket; PAT auto-resolved from macOS Keychain)
export BITBUCKET_BASE_URL="https://bitbucket.lab.dynatrace.org/rest/api/1.0"
export BITBUCKET_PAT="..."   # only needed if not using Keychain

# For Juno repo discovery
export JUNO_BASE_URL="https://juno.internal.dynatrace.com"   # default
export JUNO_TOKEN="..."   # or in Keychain as `juno-token`
```

## Auto-discover repos from Juno

Each capability in `repos.yaml` can be configured to populate its `repos:` list
from Juno (Backstage catalog) automatically:

```yaml
- name: "Platform Apps"
  juno:
    discover: true
    slug: "platform-apps-papa"        # Juno capability slug
    extra_repos:                      # always include these
      - "APPFW/papa-tools"
  repos: []                           # populated by discover.py
```

Then run:

```bash
# Refresh repos.yaml in place for every capability with juno.discover: true
python discover.py --config repos.yaml --update

# Preview what would be discovered without writing
python discover.py --config repos.yaml --dry-run

# Ad-hoc lookup by capability slug (no config needed)
python discover.py --capability platform-apps-papa
```

`discover.py` queries Juno's catalog API for `kind=component,spec.capability=<slug>`
and parses the Bitbucket project + slug from each component's
`backstage.io/source-location` annotation.

## Per-capability overrides in repos.yaml

| Field | Default | Purpose |
|---|---|---|
| `main_token_budget` | 2500 | Above this, main file is flagged as bloat |
| `pr_window_days` | 14 | PR scan window for AI-assistance signals |
| `pass_rate_target` | 70 | Target first-attempt pass rate (UI display) |
| `score_target` | 60 | Target average maturity score (UI display) |
| `ai_co_author_markers` | (8 defaults) | Substrings in commit msgs that mark AI-assisted |
| `ai_branch_patterns` | (4 defaults) | Regex prefixes for AI branch names |

`defaults:` at the top of `repos.yaml` apply to every capability; per-capability
values override.

## Usage

```bash
# Print what would be emitted (all capabilities)
python scan.py --config repos.yaml --dry-run

# Send events for real
python scan.py --config repos.yaml --emit

# One capability only
python scan.py --config repos.yaml --capability "Platform Apps" --emit

# Single repo (debug)
python scan.py --config repos.yaml --repo APPS/papa-tools --dry-run

# Skip PR scanning (much faster — repo metadata only)
python scan.py --config repos.yaml --no-prs --dry-run

# Override the per-capability PR window
python scan.py --config repos.yaml --pr-days 30 --emit
```

## What it scans per repo

- Main instruction file presence: `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`
- Rules directories: `.claude/rules/`, `.github/instructions/`, `.cursor/rules/`
- Skills: `.agents/skills/`, `.claude/skills/`
- MCP config: `.mcp.json`, `.vscode/mcp.json`, `.claude/mcp.json`
- Anti-pattern density across all context files (`Do NOT`, `NEVER`, `Avoid`)
- Self-healing instruction marker
- Champion activity (commits to context paths in last 90 days)
- Last commit on default branch
- Token estimates (chars / 4) for budget tracking
- Maturity tier classification: `none` → `main_only` → `two_tier` → `two_tier_skills` → `full_stack`
- Failure mode flags: bloat, staleness, missing self-healing, vagueness, copy-paste

## What it scans per merged PR (last 14 days by default)

- AI-assisted detection (commit Co-authored-by, branch name patterns, description markers)
- Review rounds (`NEEDS_WORK` reviews before approval)
- First-attempt pass (`review_rounds == 0`)
- Comment count
- Time to merge

## Schedule

Run nightly via cron / Workflow / GitHub Action. The scanner is idempotent and
the `ai_first.repo_scan` events are the latest-wins source of truth (use `dedup`
on `repo.slug` in DQL to get the current state).

## Schema

See [SCHEMA.md](./SCHEMA.md).
