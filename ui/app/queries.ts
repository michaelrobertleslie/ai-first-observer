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
| summarize avg_days = avg(cycle_days), p10_days = percentile(cycle_days, 10), p25_days = percentile(cycle_days, 25), p50_days = percentile(cycle_days, 50), p75_days = percentile(cycle_days, 75), p90_days = percentile(cycle_days, 90), min_days = min(cycle_days), max_days = max(cycle_days), total_closed = count()`;
}

/** Individual VI cycle times — for detail expansion */
export function viCycleTimeDetailQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND status == "Closed"
  AND isNotNull(resolutiondate) AND isNotNull(created)
| dedup key
| fieldsAdd cycle_days = (toTimestamp(resolutiondate) - toTimestamp(created)) / 86400000000000
| fields key, summary, created, resolutiondate, cycle_days
| sort cycle_days asc`;
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
| filter isNotNull(components_array) AND components_array != ""
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
| fieldsAdd created_ts = toTimestamp(created)
| filter created_ts >= now() - 365d
| fieldsAdd month = formatTimestamp(created_ts, format: "yyyy-MM")
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

/** Predictability trend — monthly fix version churn rate (12 months).
 *  For each month, count how many distinct VIs had their fixVersion change
 *  vs total active VIs. Lower = more predictable. */
export function predictabilityTrendQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 365d
| filter event.type == "jira_daily.valueincrement"
  AND \`owning Program\` == "${cap.viProgram}"
  AND in(status, "Implementation", "Ready for Implementation", "Release Preparation", "Closed", "Post GA")
| fieldsAdd month = formatTimestamp(timestamp, format: "yyyy-MM")
| sort timestamp asc
| summarize versions_seen = collectDistinct(fixVersions), snapshot_count = count(), by: {key, month}
| fieldsAdd changed = if(arraySize(versions_seen) > 1, 1, else: 0)
| summarize total_vis = countDistinct(key), changed_vis = sum(changed), by: {month}
| fieldsAdd churn_pct = 100.0 * toDouble(changed_vis) / toDouble(total_vis)
| sort month asc`;
}

/** Delivery accuracy: VIs closed by fix version (chronological, excludes Unplanned) */
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
| summarize vi_count = count(), latest_resolved = max(resolved_ts), by: {fixVersions}
| sort latest_resolved desc
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

/** Sprint commitment vs delivery — story count and points per sprint (6 months) */
export function sprintCommitmentQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 180d
| filter event.type == "jira_daily.story"
  AND project == "${cap.bugProject}"
  AND isNotNull(Sprint)
| sort timestamp desc
| summarize latest_status = takeFirst(status), latest_sprint = takeFirst(Sprint), sp = takeFirst(toDouble(\`Story Points\`)), resolved = takeFirst(resolutiondate), by: {key}
| fieldsAdd is_closed = if(latest_status == "Closed", 1, else: 0)
| fieldsAdd delivered_sp = if(latest_status == "Closed", sp, else: 0.0)
| fieldsAdd closed_date = if(latest_status == "Closed", resolved, else: null)
| summarize committed = count(), delivered = sum(is_closed), points_committed = sum(sp), points_delivered = sum(delivered_sp), last_closed = max(closed_date), by: {Sprint = latest_sprint}
| fieldsAdd delivery_pct = if(committed > 0, 100.0 * toDouble(delivered) / toDouble(committed), else: 0.0)
| fieldsAdd points_pct = if(points_committed > 0, 100.0 * points_delivered / points_committed, else: 0.0)
| parse Sprint, "LD:prefix LONG:sprint_num"
| filter committed >= 20
| sort sprint_num desc
| limit 15`;
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
  AND isNotNull(created)
| dedup key
| fieldsAdd created_ts = toTimestamp(created)
| filter created_ts >= now() - 90d
| summarize bug_count = count(), by: {\`Found in\`}
| sort bug_count desc`;
}

/** Customer-escalated production bugs for rolling quarter (90 days) */
export function derCustomerSplitRollingQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 90d
| filter event.type == "jira_daily.bug"
  AND project == "${cap.bugProject}"
  AND \`Found in\` == "PRODUCTION"
  AND isNotNull(created)
| dedup key
| fieldsAdd created_ts = toTimestamp(created)
| filter created_ts >= now() - 90d
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
| fieldsAdd resolved_ts = toTimestamp(resolutiondate)
| filter resolved_ts >= now() - 365d
| fieldsAdd month = formatTimestamp(resolved_ts, format: "yyyy-MM")
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

/* ═══════════════════════════════════════════════════════════════
   PILLAR 5 — AI-FIRST ADOPTION
   Driven by ai_first.repo_scan and ai_first.pr_event bizevents
   from scripts/ai-first-scanner/
   ═══════════════════════════════════════════════════════════════ */

/** Latest scan per repo. Used by coverage funnel, scorecard, failure flags. */
export function aiRepoLatestScanQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 7d
| filter event.type == "ai_first.repo_scan"
  AND capability == "${cap.viProgram}"
| sort timestamp desc
| dedup {\`repo.project\`, \`repo.slug\`}
| fields repo_project = \`repo.project\`,
         repo_slug = \`repo.slug\`,
         repo_name = \`repo.name\`,
         repo_url = \`repo.url\`,
         last_commit_age = \`repo.last_commit_age_days\`,
         main_present = \`context.main_file_present\`,
         main_path = \`context.main_file_path\`,
         main_tokens = \`context.main_file_tokens\`,
         main_age_days = \`context.main_file_age_days\`,
         rules_count = \`context.rules_files_count\`,
         rules_tokens = \`context.rules_files_total_tokens\`,
         skills_count = \`context.skills_count\`,
         anti_patterns = \`context.anti_pattern_count\`,
         self_healing = \`context.self_healing_present\`,
         mcp_present = \`context.mcp_config_present\`,
         mcp_servers = \`context.mcp_servers_count\`,
         tier = \`maturity.tier\`,
         score = \`maturity.score\`,
         f_bloat = \`failure.bloat\`,
         f_staleness = \`failure.staleness\`,
         f_missing_sh = \`failure.missing_self_healing\`,
         f_vagueness = \`failure.vagueness\`,
         f_copy_paste = \`failure.copy_paste\`,
         champion_author = \`champion.last_author\`,
         champion_touches_90d = \`champion.touches_90d\`,
         champion_authors_90d = \`champion.unique_authors_90d\`
| sort score desc, repo_slug asc`;
}

/** Maturity tier counts — coverage funnel data. */
export function aiMaturityFunnelQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 7d
| filter event.type == "ai_first.repo_scan"
  AND capability == "${cap.viProgram}"
| sort timestamp desc
| dedup {\`repo.project\`, \`repo.slug\`}
| summarize repo_count = count(), by: {tier = \`maturity.tier\`}
| sort tier asc`;
}

/** Failure-mode flag counts across the capability. */
export function aiFailureModesQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 7d
| filter event.type == "ai_first.repo_scan"
  AND capability == "${cap.viProgram}"
| sort timestamp desc
| dedup {\`repo.project\`, \`repo.slug\`}
| summarize bloat = countIf(\`failure.bloat\` == true),
            staleness = countIf(\`failure.staleness\` == true),
            missing_self_healing = countIf(\`failure.missing_self_healing\` == true),
            vagueness = countIf(\`failure.vagueness\` == true),
            copy_paste = countIf(\`failure.copy_paste\` == true),
            total_repos = count()`;
}

/** Repos failing one or more checks — actionable list. */
export function aiFailureDetailQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 7d
| filter event.type == "ai_first.repo_scan"
  AND capability == "${cap.viProgram}"
| sort timestamp desc
| dedup {\`repo.project\`, \`repo.slug\`}
| filter \`failure.bloat\` == true
       OR \`failure.staleness\` == true
       OR \`failure.missing_self_healing\` == true
       OR \`failure.vagueness\` == true
       OR \`failure.copy_paste\` == true
| fields repo_slug = \`repo.slug\`,
         repo_url = \`repo.url\`,
         tier = \`maturity.tier\`,
         score = \`maturity.score\`,
         bloat = \`failure.bloat\`,
         staleness = \`failure.staleness\`,
         missing_sh = \`failure.missing_self_healing\`,
         vagueness = \`failure.vagueness\`,
         copy_paste = \`failure.copy_paste\`,
         main_tokens = \`context.main_file_tokens\`,
         main_age_days = \`context.main_file_age_days\`
| sort score desc`;
}

/** Champion activity — who's actually maintaining context. */
export function aiChampionsQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 7d
| filter event.type == "ai_first.repo_scan"
  AND capability == "${cap.viProgram}"
  AND isNotNull(\`champion.last_author\`)
  AND \`champion.last_author\` != ""
| sort timestamp desc
| dedup {\`repo.project\`, \`repo.slug\`}
| summarize repos = count(),
            total_touches = sum(\`champion.touches_90d\`),
            by: {champion = \`champion.last_author\`}
| sort total_touches desc
| limit 25`;
}

/** AI-PR first-attempt pass rate — weekly trend across the capability. */
export function aiPrFirstAttemptTrendQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 90d
| filter event.type == "ai_first.pr_event"
  AND capability == "${cap.viProgram}"
  AND \`pr.is_ai_assisted\` == true
| fieldsAdd week = formatTimestamp(toTimestamp(\`pr.merged\`), format: "yyyy-'W'ww")
| summarize total_prs = count(),
            first_attempt = countIf(\`pr.first_attempt_pass\` == true),
            by: {week}
| fieldsAdd pass_rate = if(total_prs > 0, toDouble(first_attempt) / toDouble(total_prs) * 100.0, else: 0.0)
| sort week asc`;
}

/** AI vs human PR comparison — review rounds and first-attempt pass. */
export function aiPrSplitQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 30d
| filter event.type == "ai_first.pr_event"
  AND capability == "${cap.viProgram}"
| summarize total_prs = count(),
            first_attempt = countIf(\`pr.first_attempt_pass\` == true),
            avg_rounds = avg(\`pr.review_rounds\`),
            avg_comments = avg(\`pr.comment_count\`),
            avg_ttm_hours = avg(\`pr.time_to_merge_hours\`),
            by: {is_ai = \`pr.is_ai_assisted\`}
| fieldsAdd cohort = if(is_ai == true, "AI-assisted", else: "Human-only"),
            pass_rate = if(total_prs > 0, toDouble(first_attempt) / toDouble(total_prs) * 100.0, else: 0.0)
| sort cohort asc`;
}

/** Per-repo correction-cycle heatmap data: comments per AI PR over weeks. */
export function aiCorrectionHeatmapQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 84d
| filter event.type == "ai_first.pr_event"
  AND capability == "${cap.viProgram}"
  AND \`pr.is_ai_assisted\` == true
| fieldsAdd week = formatTimestamp(toTimestamp(\`pr.merged\`), format: "yyyy-'W'ww")
| summarize avg_comments = avg(\`pr.comment_count\`),
            avg_rounds = avg(\`pr.review_rounds\`),
            pr_count = count(),
            by: {repo = \`repo.slug\`, week}
| sort repo asc, week asc`;
}

/** Adoption summary KPI for the Overview hero. */
export function aiAdoptionSummaryQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 7d
| filter event.type == "ai_first.repo_scan"
  AND capability == "${cap.viProgram}"
| sort timestamp desc
| dedup {\`repo.project\`, \`repo.slug\`}
| summarize total = count(),
            with_main = countIf(\`context.main_file_present\` == true),
            two_tier_plus = countIf(in(\`maturity.tier\`, "two_tier", "two_tier_skills", "full_stack")),
            full_stack = countIf(\`maturity.tier\` == "full_stack"),
            avg_score = avg(\`maturity.score\`)`;
}

/** Recent AI-assisted PRs detail — drill-down list. */
export function aiRecentPrsQuery(cap: Capability): string {
  return `fetch bizevents, from: now() - 14d
| filter event.type == "ai_first.pr_event"
  AND capability == "${cap.viProgram}"
  AND \`pr.is_ai_assisted\` == true
| fields repo = \`repo.slug\`,
         pr_id = \`pr.id\`,
         title = \`pr.title\`,
         url = \`pr.url\`,
         author = \`pr.author\`,
         signals = \`pr.ai_signals\`,
         comments = \`pr.comment_count\`,
         rounds = \`pr.review_rounds\`,
         first_pass = \`pr.first_attempt_pass\`,
         ttm_hours = \`pr.time_to_merge_hours\`,
         merged = \`pr.merged\`
| sort merged desc
| limit 50`;
}
