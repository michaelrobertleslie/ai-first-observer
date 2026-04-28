---
description: DQL query patterns, data model, and gotchas for AI-First Observer queries
globs: ui/app/queries.ts, ui/app/config.ts
---

# DQL Query Rules

## Data Model

### Daily Snapshots (3 event types)
| Event Type | Content | Key Filter Field |
|---|---|---|
| `jira_daily.valueincrement` | Value Increments | `owning Program` (backtick-quoted — has a space) |
| `jira_daily.bug` | Bugs | `project` |
| `jira_daily.story` | Stories | `project` |

Each produces one record per issue per day. Change detection by comparing daily snapshots.

### Capability System
All queries accept a `Capability` config object from `config.ts`. The capability determines filter values (`viProgram`, `bugProject`), scorecard asset slugs, and Juno catalog URLs.

### DER (Defect Escape Rate)
- Production bugs = bugs where `Found in` == `"PRODUCTION"`
- Customer-escalated = `Support-triggered` == `true`
- DER = production bugs / total bugs

### Sprint Commitment
- Uses each story's **latest** sprint assignment (counted once)
- `parse Sprint, "LD:prefix LONG:sprint_num"` for numeric sorting
- Filters sprints with <20 stories

## DQL Gotchas
- `split()` does NOT exist in DQL — use `parse` with pattern matchers (LD, LONG, WORD)
- Always `verify_dql` before shipping new queries
- Template literals with backtick-quoted fields (e.g. `` `owning Program` ``) need careful escaping — use single-quoted string constants
- `max()` on mixed types is fragile — use `null` not empty string for else branches
