/**
 * DQL queries for the AI-First Observer.
 *
 * All queries accept a capability parameter to scope data.
 * The daily Jira snapshot gives one record per issue per day,
 * so we use countDistinct(key) for unique issue counts and
 * day-over-day comparison for change detection.
 */

import type { Capability } from "./config";

/* ═══════════════════════════════════════════════════════════════
   PILLAR 1 — UNLOCK VALUE (Throughput & Cycle Time)
   ═══════════════════════════════════════════════════════════════ */

/** VIs closed per month (throughput trend, last 12 months — filtered by resolution date) */
export function viThroughputTrendQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status == "Closed"
  AND isNotNull(resolutiondate)
| dedup key
| fieldsAdd resolved_ts = toTimestamp(resolutiondate)
| filter resolved_ts >= now() - 365d
| fieldsAdd month = formatTimestamp(resolved_ts, format: "yyyy-MM")
| summarize vi_count = count(), by: {month}
| sort month asc`;
}

/** Cycle time distribution of closed VIs (created → resolution) */
export function viCycleTimeQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status == "Closed"
  AND isNotNull(resolutiondate) AND isNotNull(created)
| dedup key
| fieldsAdd cycle_days = (toTimestamp(resolutiondate) - toTimestamp(created)) / 86400000000000
| summarize avg_days = avg(cycle_days), p50_days = percentile(cycle_days, 50), p90_days = percentile(cycle_days, 90), total_closed = count()`;
}

/** Cycle time trend — average per month for closed VIs */
export function viCycleTimeTrendQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status == "Closed"
  AND isNotNull(resolutiondate) AND isNotNull(created)
| dedup key
| fieldsAdd cycle_days = (toTimestamp(resolutiondate) - toTimestamp(created)) / 86400000000000
| fieldsAdd month = formatTimestamp(toTimestamp(resolutiondate), format: "yyyy-MM")
| summarize avg_cycle = avg(cycle_days), p50_cycle = percentile(cycle_days, 50), vi_count = count(), by: {month}
| sort month asc`;
}

/** VI pipeline — current status breakdown (active only) */
export function viPipelineQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 1d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status != "Cancelled" AND status != "Closed"
| dedup key
| summarize count = count(), by: {status}
| sort count desc`;
}

/** Active VIs detail (not Closed/Cancelled) */
export function activeVisQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 1d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status != "Cancelled" AND status != "Closed"
| dedup key
| fields key, summary, status, fixVersions, \`Target start\`, \`Target end\`, assignee
| sort status asc`;
}

/* ═══════════════════════════════════════════════════════════════
   PILLAR 2 — QUALITY (Defect Escape Rate)
   ═══════════════════════════════════════════════════════════════ */

/** DER summary — unique bugs by "Found in" category (excludes unset) */
export function derSummaryQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.bug"
  AND project == "${cap.bugProject}"
  AND isNotNull(\`Found in\`) AND \`Found in\` != ""
| dedup key
| summarize bug_count = count(), by: {\`Found in\`}
| sort bug_count desc`;
}

/** DER trend — production escape rate per month */
export function derTrendQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.bug"
  AND project == "${cap.bugProject}"
  AND isNotNull(created)
| dedup key
| fieldsAdd month = formatTimestamp(toTimestamp(created), format: "yyyy-MM")
| fieldsAdd is_prod = if(\`Found in\` == "PRODUCTION", 1, else: 0)
| summarize total = count(), prod_count = sum(is_prod), by: {month}
| fieldsAdd der_pct = 100.0 * toDouble(prod_count) / toDouble(total)
| sort month asc`;
}

/** Bug severity distribution for production-found bugs */
export function prodBugsByComponentQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.bug"
  AND project == "${cap.bugProject}"
  AND \`Found in\` == "PRODUCTION"
| dedup key
| expand components_array
| summarize bug_count = count(), by: {components_array}
| sort bug_count desc
| limit 15`;
}

/** Recent production bugs (last 90 days) with escalation source */
export function recentProdBugsQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 90d
| filter event.type == "jira_daily.bug"
  AND project == "${cap.bugProject}"
  AND \`Found in\` == "PRODUCTION"
| dedup key
| fields key, summary, status, \`Support-triggered\`, components_array, assignee, created, resolution
| sort created desc
| limit 50`;
}

/** Production bugs split by customer-escalation (Support-triggered) */
export function derCustomerSplitQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.bug"
  AND project == "${cap.bugProject}"
  AND \`Found in\` == "PRODUCTION"
| dedup key
| fieldsAdd source = if(\`Support-triggered\` == "true", "Customer-Escalated", else: "Internally Discovered")
| summarize bug_count = count(), by: {source}
| sort bug_count desc`;
}

/** DER trend with customer-escalation split per month (12 months) */
export function derSplitTrendQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.bug"
  AND project == "${cap.bugProject}"
  AND isNotNull(created)
  AND isNotNull(\`Found in\`) AND \`Found in\` != ""
| dedup key
| fieldsAdd month = formatTimestamp(toTimestamp(created), format: "yyyy-MM")
| fieldsAdd is_prod = if(\`Found in\` == "PRODUCTION", 1, else: 0)
| fieldsAdd is_customer = if(\`Found in\` == "PRODUCTION" AND \`Support-triggered\` == "true", 1, else: 0)
| summarize total = count(), prod_count = sum(is_prod), customer_count = sum(is_customer), by: {month}
| fieldsAdd der_pct = 100.0 * toDouble(prod_count) / toDouble(total)
| fieldsAdd customer_der_pct = 100.0 * toDouble(customer_count) / toDouble(total)
| fieldsAdd internal_count = prod_count - customer_count
| sort month asc`;
}

/* ═══════════════════════════════════════════════════════════════
   PILLAR 3 — PREDICTABILITY (Fix Version Stability)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Fix-version changes detected via daily snapshots.
 * Compare today's snapshot vs yesterday's for VIs in Implementation+.
 */
export function fixVersionChangesQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 2d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND in(status, "Implementation", "Ready for Implementation", "Release Preparation")
| sort timestamp desc
| summarize latest_fv = takeFirst(fixVersions), earliest_fv = takeLast(fixVersions), latest_status = takeFirst(status), snapshots = count(), by: {key, summary}
| filter snapshots >= 2 AND latest_fv != earliest_fv
| fields key, summary, latest_status, earliest_fv, latest_fv`;
}

/**
 * Fix-version stability over last 30 days.
 * For each VI in implementation, count how many days the fixVersion differed from the previous day.
 */
export function fixVersionStability30dQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 30d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND in(status, "Implementation", "Ready for Implementation", "Release Preparation", "Closed", "Post GA")
| sort timestamp asc
| summarize versions_seen = collectDistinct(fixVersions), snapshot_count = count(), latest_status = takeLast(status), by: {key, summary}
| fieldsAdd version_changes = arraySize(versions_seen) - 1
| filter version_changes > 0
| sort version_changes desc`;
}

/** Target date drift: VIs where Target end changed in last 30 days */
export function targetDateDriftQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 30d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND in(status, "Implementation", "Ready for Implementation", "Release Preparation")
| sort timestamp asc
| summarize dates_seen = collectDistinct(\`Target end\`), snapshot_count = count(), latest_status = takeLast(status), by: {key, summary}
| fieldsAdd date_changes = arraySize(dates_seen) - 1
| filter date_changes > 0
| sort date_changes desc`;
}

/** Delivery accuracy: VIs closed by fix version (newest first, excludes Unplanned) */
export function deliveryAccuracyQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status == "Closed"
  AND isNotNull(fixVersions)
  AND NOT contains(fixVersions, "nplanned")
| dedup key
| fieldsAdd resolved_ts = toTimestamp(resolutiondate)
| filter resolved_ts >= now() - 365d
| summarize vi_count = count(), by: {fixVersions}
| sort fixVersions desc
| limit 20`;
}

/** Unplanned VIs — closed VIs with 'Unplanned' in fixVersions */
export function unplannedVisQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status == "Closed"
  AND isNotNull(fixVersions)
  AND contains(fixVersions, "nplanned")
| dedup key
| fields key, summary, fixVersions, resolutiondate
| sort resolutiondate desc
| limit 50`;
}

/* ═══════════════════════════════════════════════════════════════
   PILLAR 4 — DEVELOPER EXPERIENCE (Proxy metrics)
   ═══════════════════════════════════════════════════════════════ */

/** Story throughput per sprint (velocity proxy) */
export function storyVelocityQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 90d
| filter event.type == "jira_daily.story"
  AND project == "${cap.bugProject}"
  AND status == "Closed"
  AND isNotNull(Sprint)
| dedup key
| summarize stories_closed = count(), total_points = sum(\`Story Points\`), by: {Sprint}
| sort Sprint desc
| limit 20`;
}

/** Story cycle time trend — average days from created to closed, per month (6 months) */
export function storyCycleTimeTrendQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 180d
| filter event.type == "jira_daily.story"
  AND project == "${cap.bugProject}"
  AND status == "Closed"
  AND isNotNull(resolutiondate) AND isNotNull(created)
| dedup key
| fieldsAdd cycle_days = (toTimestamp(resolutiondate) - toTimestamp(created)) / 86400000000000
| fieldsAdd month = formatTimestamp(toTimestamp(resolutiondate), format: "yyyy-MM")
| summarize avg_cycle = avg(cycle_days), p50_cycle = percentile(cycle_days, 50), stories = count(), by: {month}
| sort month asc`;
}

/** Work-in-progress: active stories not yet closed */
export function wipQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 1d
| filter event.type == "jira_daily.story"
  AND project == "${cap.bugProject}"
  AND in(status, "In Progress", "In Review", "In Verification")
| dedup key
| summarize wip_count = count(), by: {status, Team}
| sort wip_count desc`;
}

/* ═══════════════════════════════════════════════════════════════
   BASELINE — Snapshot metrics for comparison
   ═══════════════════════════════════════════════════════════════ */

/** Overall baseline metrics in a single query */
export function baselineSummaryQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status == "Closed"
  AND isNotNull(resolutiondate) AND isNotNull(created)
| dedup key
| fieldsAdd cycle_days = (toTimestamp(resolutiondate) - toTimestamp(created)) / 86400000000000
| summarize total_closed = count(), avg_cycle_days = avg(cycle_days), p50_cycle_days = percentile(cycle_days, 50), p90_cycle_days = percentile(cycle_days, 90)`;
}

/** DER for rolling quarter (90 days, excludes unset) */
export function derRollingQuarterQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 90d
| filter event.type == "jira_daily.bug"
  AND project == "${cap.bugProject}"
  AND isNotNull(\`Found in\`) AND \`Found in\` != ""
| dedup key
| summarize bug_count = count(), by: {\`Found in\`}
| sort bug_count desc`;
}

/** Customer-escalated production bugs for rolling quarter (90 days) */
export function derCustomerSplitRollingQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 90d
| filter event.type == "jira_daily.bug"
  AND project == "${cap.bugProject}"
  AND \`Found in\` == "PRODUCTION"
| dedup key
| fieldsAdd source = if(\`Support-triggered\` == "true", "Customer-Escalated", else: "Internally Discovered")
| summarize bug_count = count(), by: {source}
| sort bug_count desc`;
}

/** Quarterly VI throughput comparison (last 6 quarters) */
export function viQuarterlyThroughputQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 730d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status == "Closed"
  AND isNotNull(resolutiondate)
| dedup key
| fieldsAdd resolved_ts = toTimestamp(resolutiondate)
| fieldsAdd quarter = concat(formatTimestamp(resolved_ts, format: "yyyy"), "-Q", toString(toDouble(formatTimestamp(resolved_ts, format: "MM")) / 3.1 + 1.0))
| fieldsAdd quarter_label = concat(formatTimestamp(resolved_ts, format: "yyyy"), if(toDouble(formatTimestamp(resolved_ts, format: "MM")) <= 3, "-Q1", else: if(toDouble(formatTimestamp(resolved_ts, format: "MM")) <= 6, "-Q2", else: if(toDouble(formatTimestamp(resolved_ts, format: "MM")) <= 9, "-Q3", else: "-Q4"))))
| summarize vi_count = count(), by: {quarter_label}
| sort quarter_label asc`;
}

/** Story points delivered per VI (guard rail against VI inflation) */
export function storyPointsPerViQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.story"
  AND project == "${cap.bugProject}"
  AND status == "Closed"
  AND isNotNull(\`Story Points\`)
  AND isNotNull(resolutiondate)
| dedup key
| fieldsAdd month = formatTimestamp(toTimestamp(resolutiondate), format: "yyyy-MM")
| summarize total_points = sum(\`Story Points\`), stories = count(), by: {month}
| sort month asc`;
}

/** WIP detail — individual stories for drill-down */
export function wipDetailQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 1d
| filter event.type == "jira_daily.story"
  AND project == "${cap.bugProject}"
  AND in(status, "In Progress", "In Review", "In Verification")
| dedup key
| fields key, summary, status, Team, assignee, created
| sort Team asc, status asc`;
}

/** Fix version changes with previous/current values for expanded view */
export function fixVersionChangesExpandedQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 7d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND in(status, "Implementation", "Ready for Implementation", "Release Preparation")
| sort timestamp desc
| summarize latest_fv = takeFirst(fixVersions), earliest_fv = takeLast(fixVersions), latest_status = takeFirst(status), latest_target = takeFirst(\`Target end\`), snapshots = count(), by: {key, summary}
| filter snapshots >= 2 AND latest_fv != earliest_fv
| fields key, summary, latest_status, earliest_fv, latest_fv, latest_target`;
}
