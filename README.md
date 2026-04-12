# AI-First Observer

Measures the impact of AI-First on software delivery across four pillars: **Unlock Value**, **Quality**, **Predictability**, and **Developer Experience**.

Defaults to Platform Apps (PAPA) but supports any capability via a dropdown selector.

**Live app**: [https://umsaywsjuo.dev.apps.dynatracelabs.com/ui/apps/my.ai.first.observer](https://umsaywsjuo.dev.apps.dynatracelabs.com/ui/apps/my.ai.first.observer)

---

## Architecture

```
ui/app/
├── config.ts              # Capability registry, scorecard config (219 lines)
├── queries.ts             # All DQL queries — 27 query functions (400 lines)
├── CapabilityContext.tsx   # React context for capability switching
├── App.tsx                # Routes: /, /value, /quality, /predictability, /devex
├── components/
│   ├── Header.tsx         # Navigation + capability selector
│   └── Card.tsx           # Reusable card component
└── pages/
    ├── Overview.tsx        # Hero KPIs with gauge rings, pillar nav cards, Juno links
    ├── UnlockValue.tsx     # VI throughput, cycle time, pipeline
    ├── Quality.tsx         # DER summary/split, scorecards, trend, component bugs
    ├── Predictability.tsx  # Fix version stability, target date drift
    └── DevExperience.tsx   # Sprint velocity, story cycle time, WIP
```

## Data Sources

All data comes from daily Jira snapshots stored as business events:

| Event Type | Content | Key Fields |
|---|---|---|
| `jira_daily.valueincrement` | Value Increments | `owning Program`, `status`, `fixVersions`, `created`, `resolutiondate` |
| `jira_daily.bug` | Bugs | `project`, `Found in` (DEV/SPRINT/PRODUCTION), `Support-triggered` |
| `jira_daily.story` | Stories | `project`, `Sprint`, `Story Points`, `Team` |

Each event type produces one record per issue per day, enabling change detection (fix version changes, target date drift) by comparing daily snapshots.

## Adding a New Capability

Edit `ui/app/config.ts` and add an entry to the `CAPABILITIES` record:

```typescript
MY_CAP: {
  label: "My Capability",
  viProgram: "My Capability",         // matches `owning Program` in jira_daily.valueincrement
  bugProject: "My Capability",        // matches `project` in jira_daily.bug / jira_daily.story
  junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/my-capability",
  scorecardAssets: [                   // optional — links to quality dashboard scorecards
    { label: "Component A", asset: "component-a" },
    { label: "Component B", asset: "some.app.id" },
  ],
  junoLinks: [                         // optional — Juno catalog pages without a scorecard
    { label: "My SDK", url: "https://juno.internal.dynatrace.com/catalog/default/system/my-sdk" },
  ],
},
```

### Scorecard Configuration

Component scorecards link to a shared quality dashboard on `dre63214.apps.dynatrace.com`. Each component is identified by a `vfilter_asset` slug.

**Finding the asset slug**: Open the scorecard dashboard for your component in the browser. The URL will contain `vfilter_asset=<slug>` — that slug is what goes in the `asset` field.

**URL pattern**:
```
https://dre63214.apps.dynatrace.com/ui/apps/dynatrace.dashboards/dashboard/
  monaco-643204c8-ddb7-3891-9842-063f1dc1b1cf
  #from=now()-14d&to=now()&vfilter_assetVersion=summary&vfilter_asset={asset}
```

The `scorecardUrl()` helper in `config.ts` generates these URLs automatically.

**Current PAPA scorecards** (9 components):

| Component | Asset Slug |
|---|---|
| Dashboards | `dashboards` |
| Dashboards CLI | `dashboard-cli` |
| AppShell | `app-shell` |
| Intent Explorer | `dynatrace.intent.explorer-app` |
| Onion Logs | `dynatrace.onion.logs-app` |
| Launcher | `launcher` |
| Notebooks | `notebooks` |
| Search Service | `search-service` |
| SmartScape App | `dynatrace.smartscape-app` |

**Juno catalog links** (no scorecard dashboard, linked to Juno directly):

| Component | Type |
|---|---|
| Data Exploration | SDK system page |
| DQL Builder | SDK component page |

### DER Customer Split

Production bugs are split into **Customer-Escalated** (Support-triggered = true) and **Internally Discovered** using the `Support-triggered` field on Jira bug records. This differentiates bugs that reached customers from those caught internally in production.

## Development

```bash
npx dt-app dev     # Start development server
npx dt-app build   # Build for deployment
npx dt-app deploy  # Deploy to environment
```

## Environment

- **App ID**: `my.ai.first.observer`
- **Version**: 0.4.1
- **Target**: `umsaywsjuo.dev.apps.dynatracelabs.com`
