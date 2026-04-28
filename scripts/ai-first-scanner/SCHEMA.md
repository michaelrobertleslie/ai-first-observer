# AI-First Bizevent Schema

Two event types feed the AI-First Adoption pillar.

## `ai_first.repo_scan`

One event per repo per scan run. Run nightly.

| Field | Type | Notes |
|---|---|---|
| `event.type` | string | `"ai_first.repo_scan"` |
| `event.provider` | string | `"ai-first-scanner"` |
| `capability` | string | Maps to `Capability.viProgram` (e.g. `"Platform Apps"`) |
| `repo.project` | string | Bitbucket project key (e.g. `"APPS"`) |
| `repo.slug` | string | Repo slug |
| `repo.name` | string | Display name |
| `repo.url` | string | Browse URL |
| `repo.last_commit_date` | timestamp | Latest commit on default branch |
| `repo.last_commit_age_days` | long | Days since last commit |
| `context.main_file_present` | boolean | Any of `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md` |
| `context.main_file_path` | string | Which one was found |
| `context.main_file_tokens` | long | Estimated token count (chars / 4) |
| `context.main_file_last_modified` | timestamp |  |
| `context.main_file_age_days` | long | Days since last modified |
| `context.rules_dir_present` | boolean | Any of `.claude/rules/`, `.github/instructions/`, `.cursor/rules/` |
| `context.rules_files_count` | long |  |
| `context.rules_files_total_tokens` | long | Sum of all rules files |
| `context.skills_count` | long | Files in `.agents/skills/` or `.claude/skills/` |
| `context.anti_pattern_count` | long | Lines matching `Do NOT`, `NEVER`, `Avoid` (case-insensitive) across context files |
| `context.self_healing_present` | boolean | Main file mentions "flag the discrepancy" or "self-healing" or "contradicts these instructions" |
| `context.mcp_config_present` | boolean | `.mcp.json` or similar present |
| `context.mcp_servers_count` | long |  |
| `maturity.tier` | string | `"none"` \| `"main_only"` \| `"two_tier"` \| `"two_tier_skills"` \| `"full_stack"` |
| `maturity.score` | long | 0-100 composite |
| `failure.bloat` | boolean | `main_file_tokens > 2500` |
| `failure.staleness` | boolean | `main_file_age_days > 90 AND last_commit_age_days < 30` |
| `failure.missing_self_healing` | boolean |  |
| `failure.vagueness` | boolean | `anti_pattern_count < 3 AND main_file_tokens > 500` |
| `failure.copy_paste` | boolean | Main file is byte-identical to any other repo's main file |
| `champion.last_author` | string | Last committer to context files |
| `champion.touches_90d` | long | Commits to context paths in last 90 days |
| `champion.unique_authors_90d` | long | Distinct authors touching context |

### Maturity tier rules

| Tier | Conditions |
|---|---|
| `none` | No main file |
| `main_only` | Main file present, no rules dir, no skills |
| `two_tier` | Main file + rules files (>=1) |
| `two_tier_skills` | Above + skills (>=1) |
| `full_stack` | Above + MCP config |

### Maturity score (0-100)

- Main file present: +20
- Main file lean (<=2500 tokens): +10
- Self-healing instruction: +10
- Anti-pattern density >= 5: +15
- Rules files >= 2: +15
- Skills >= 1: +10
- MCP config: +10
- Recently maintained (context age < 60 days): +10

## `ai_first.pr_event`

One event per merged PR. Run on Bitbucket webhook or daily backfill.

| Field | Type | Notes |
|---|---|---|
| `event.type` | string | `"ai_first.pr_event"` |
| `event.provider` | string | `"ai-first-scanner"` |
| `capability` | string |  |
| `repo.project` | string |  |
| `repo.slug` | string |  |
| `pr.id` | long | Bitbucket PR ID |
| `pr.title` | string |  |
| `pr.url` | string |  |
| `pr.author` | string | Email |
| `pr.is_ai_assisted` | boolean | True if any AI signal present |
| `pr.ai_signals` | array | e.g. `["copilot_in_message", "claude_coauthor", "ai_label", "ai_branch_name"]` |
| `pr.comment_count` | long | Total review comments |
| `pr.review_rounds` | long | Number of `NEEDS_WORK` reviews before approval |
| `pr.first_attempt_pass` | boolean | `review_rounds == 0` |
| `pr.created` | timestamp |  |
| `pr.merged` | timestamp |  |
| `pr.time_to_merge_hours` | double |  |
| `pr.changed_files` | long |  |
| `pr.lines_added` | long |  |
| `pr.lines_removed` | long |  |

### AI-assisted detection heuristics

A PR is `is_ai_assisted == true` if ANY of:

- Commit message contains `Co-authored-by: Claude` / `Co-authored-by: GitHub Copilot` / `Co-authored-by: Cursor`
- Commit message contains `[AI]`, `[ai-generated]`, `[copilot]`, `[claude]` tag
- PR description contains `🤖 Generated with` or `Co-authored-by` AI signature
- Branch name matches `copilot/*`, `ai/*`, `claude/*`
- PR has label `ai-assisted` or `copilot`
