# AI-First Observer — Copilot Instructions

## What This Is
A Dynatrace platform app (v0.4.1) measuring the impact of AI-First on software delivery across four pillars: Unlock Value, Quality, Predictability, and Developer Experience. Defaults to Platform Apps (PAPA) but supports any capability via a dropdown selector.

## Environment
- **App ID**: `my.ai.first.observer`
- **Target**: `umsaywsjuo.dev.apps.dynatracelabs.com`
- **Scopes**: `storage:logs:read`, `storage:buckets:read`, `storage:bizevents:read`

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

## Architecture
```
ui/app/
├── config.ts              # CAPABILITIES registry, scorecardUrl() helper (219 lines)
├── queries.ts             # 27 DQL query functions, all accept Capability (400 lines)
├── CapabilityContext.tsx   # React context for capability switching
├── App.tsx                # 5 routes: /, /value, /quality, /predictability, /devex
├── components/
│   ├── Header.tsx         # Navigation + capability selector dropdown
│   └── Card.tsx           # Reusable card component
└── pages/
    ├── Overview.tsx        # Hero KPIs with gauge rings, trend arrows, pillar nav
    ├── UnlockValue.tsx     # VI throughput, cycle time, pipeline
    ├── Quality.tsx         # DER summary/split, scorecards, trend, component bugs
    ├── Predictability.tsx  # FV stability, target date drift, delivery accuracy
    └── DevExperience.tsx   # Sprint velocity, story cycle time, WIP
```

## Key Patterns

### Trend Arrows
Each pillar Overview card shows a trend indicator (↗ Improving / ↘ Declining / → Stable). Direction logic is pillar-dependent — e.g. for Quality, *lower* DER is improving; for Unlock Value, *higher* throughput is improving. See Overview.tsx `trendDirection` logic.

### Gauge Rings
Overview hero KPIs use custom SVG gauge rings. Each ring shows a percentage with color coding (green/amber/red thresholds vary by pillar).

### Scorecard Links
Component scorecards link to a shared quality dashboard on `dre63214.apps.dynatrace.com` using `vfilter_asset=<slug>` URL parameters.

## Strato Gotchas (Learned the Hard Way)
- **Select dropdowns**: `SelectOption` MUST be wrapped in `SelectContent` — without it, options silently don't render
- **Select multi-select**: Use `multiple` prop; value becomes `string[]`, onChange returns `string[]`
- **Select empty value**: Empty string `""` is invalid — use a sentinel like `"all"`
- **Chart legends**: Hide with `<CategoricalBarChart.Legend hidden />` (child component, not prop)
- **DataTable dotted accessors**: `accessor: "fv.name"` treats dots as nested paths — alias flat DQL fields with dots to simple names using `fieldsAdd`
- **DataTable nesting**: Can't nest DataTable inside ExpandableRow — use custom accordion
- **Cell alignment**: Custom renderers need `display: "flex", alignItems: "center", height: "100%"`
- **Padding tokens**: Only 0|2|4|6|8|12|16|20|24|32|40|48|56|64
- **Color tokens**: `Colors.Charts.Apdex.{Excellent|Good|Fair|Poor|Unacceptable}.Default`
- **Imports**: Always import from subcategory path (`/layouts`, `/typography`) — never from package root

## Development
```bash
npx dt-app dev      # Start dev server
npx dt-app build    # Build
npx dt-app deploy   # Deploy
```

## Related
- **AGENTS.md** — Generic DQL/Strato/dt-app instructions (loaded automatically)
- **papa-delivery-pulse** — Sibling repo for delivery tracking
