# AI-First Observer

A Dynatrace platform app (v0.6.6) measuring the impact of AI-First on software delivery across four pillars: Unlock Value, Quality, Predictability, and Developer Experience. Defaults to Platform Apps (PAPA) but supports any capability via a dropdown selector.

## Environment
- **App ID**: `my.ai.first.observer`
- **Target**: `umsaywsjuo.dev.apps.dynatracelabs.com`
- **Scopes**: `storage:logs:read`, `storage:buckets:read`, `storage:bizevents:read`, `storage:events:read`, `storage:metrics:read`

## Commands
```bash
npx dt-app dev      # Start dev server
npx dt-app build    # Build
npx dt-app deploy   # Deploy (bump version in app.config.json first — same version = HTTP 400)
```

## Architecture
```
ui/app/
├── config.ts              # CAPABILITIES registry, scorecardUrl() helper (222 lines)
├── queries.ts             # 29 DQL query functions, all accept Capability (433 lines)
├── CapabilityContext.tsx   # React context for capability switching
├── App.tsx                # 5 routes: /, /value, /quality, /predictability, /devex
├── components/
│   ├── Header.tsx         # Navigation + capability selector dropdown
│   ├── Card.tsx           # Reusable card component
│   └── QueryInspector.tsx # DQL inspector — Sheet overlay with query + copy + Notebooks link
└── pages/
    ├── Overview.tsx        # Hero KPIs with gauge rings, trend arrows, pillar nav
    ├── UnlockValue.tsx     # VI throughput, cycle time (math verification + detail table), pipeline, adoption link
    ├── Quality.tsx         # DER summary/split, scorecards, trend, component bugs
    ├── Predictability.tsx  # FV stability, target date drift, delivery accuracy, sprint commitment
    └── DevExperience.tsx   # Sprint velocity, story cycle time, WIP
```

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

## Key Patterns

### QueryInspector (DQL Transparency)
Every data card has a `⟨/⟩ DQL` button that opens a Strato Sheet overlay with raw query, copy button, and "Open in Notebook" link via `getIntentLink` from `@dynatrace-sdk/navigation`.

### Sprint Commitment
Uses each story's **latest** sprint assignment (counted once). `parse Sprint, "LD:prefix LONG:sprint_num"` for numeric sorting. Filters sprints with <20 stories.

## DQL Gotchas
- `split()` does NOT exist in DQL — use `parse` with pattern matchers (LD, LONG, WORD)
- Always `verify_dql` before shipping new queries
- Template literals with backtick-quoted fields need careful escaping — use string constants
- `max()` on mixed types is fragile — use `null` not empty string for else branches

## Strato Gotchas
- **Select dropdowns**: `SelectOption` MUST be wrapped in `SelectContent`
- **Select empty value**: Use a sentinel like `"all"`, not empty string `""`
- **DataTable dotted accessors**: `accessor: "fv.name"` treats dots as nested paths — alias with `fieldsAdd`
- **DataTable nesting**: Can't nest DataTable inside ExpandableRow — use custom accordion
- **Cell alignment**: Custom renderers need `display: "flex", alignItems: "center", height: "100%"`
- **Padding tokens**: Only 0|2|4|6|8|12|16|20|24|32|40|48|56|64
- **Imports**: Always import from subcategory path (`/layouts`, `/typography`) — never from package root

## Related
- **AGENTS.md** in this repo — Generic DQL/Strato/dt-app development instructions
- **papa-delivery-pulse** — Sibling repo for delivery tracking
