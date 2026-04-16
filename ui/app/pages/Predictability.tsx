import React, { useMemo, useState } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { ResultRecord } from "@dynatrace-sdk/client-query";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { useCapability } from "../CapabilityContext";
import { jiraUrl } from "../config";
import {
  fixVersionChangesExpandedQuery,
  fixVersionStability30dQuery,
  targetDateDriftQuery,
  deliveryAccuracyQuery,
  unplannedVisQuery,
  predictabilityTrendQuery,
  sprintCommitmentQuery,
} from "../queries";
import { QueryInspector } from "../components/QueryInspector";

type Col = DataTableColumnDef<ResultRecord>;

function card(children: React.ReactNode, style?: React.CSSProperties) {
  return (
    <Surface style={{ width: "100%", ...style }}>
      <Flex flexDirection="column" gap={12} padding={24}>{children}</Flex>
    </Surface>
  );
}

function loading() {
  return <Flex justifyContent="center" padding={24}><ProgressCircle /></Flex>;
}

function empty(msg: string) {
  return <Paragraph style={{ opacity: 0.5 }}>{msg}</Paragraph>;
}

/* ── Sprint commitment vs delivery ──────────────────── */
function SprintCommitment() {
  const { capability } = useCapability();
  const query = sprintCommitmentQuery(capability);
  const { data, isLoading } = useDql({ query });

  // Current sprint = highest sprint_num with any deliveries (data sorted desc)
  const currentSprintIdx = useMemo(() => {
    const records = data?.records ?? [];
    return records.findIndex((r) => Number(r.delivered) > 0);
  }, [data]);

  // Columns filtered to sprints with ≥20 stories (noise filter in DQL)
  const columns: Col[] = useMemo(
    () => [
      {
        id: "Sprint", accessor: "Sprint", header: "Sprint", minWidth: 200,
        cell: ({ value, rowIndex }: { value: unknown; rowIndex: number }) => (
          <span style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
            {String(value ?? "")}
            {rowIndex === currentSprintIdx && (
              <span style={{
                background: Colors.Charts.Apdex.Good.Default,
                color: "#000",
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 4,
                letterSpacing: 0.5,
              }}>
                CURRENT
              </span>
            )}
          </span>
        ),
      },
      {
        id: "sprint_start", accessor: "sprint_start", header: "Started", minWidth: 110,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%", opacity: 0.7 }}>
            {value ? String(value).substring(0, 10) : "—"}
          </span>
        ),
      },
      { id: "committed", accessor: "committed", header: "Stories", minWidth: 90, alignment: "right" as const },
      { id: "delivered", accessor: "delivered", header: "Closed", minWidth: 90, alignment: "right" as const },
      {
        id: "delivery_pct", accessor: "delivery_pct", header: "Delivery %", minWidth: 110, alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const pct = Number(value) || 0;
          const notStarted = pct < 5;
          const color = notStarted ? undefined : pct >= 80 ? Colors.Charts.Apdex.Good.Default : pct >= 60 ? Colors.Charts.Apdex.Fair.Default : Colors.Charts.Apdex.Poor.Default;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color, fontWeight: 600, opacity: notStarted ? 0.35 : 1 }}>
              {pct.toFixed(0)}%
            </span>
          );
        },
      },
      {
        id: "points_committed", accessor: "points_committed", header: "SP Committed", minWidth: 110, alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Math.round(Number(value) || 0)}
          </span>
        ),
      },
      {
        id: "points_delivered", accessor: "points_delivered", header: "SP Delivered", minWidth: 110, alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Math.round(Number(value) || 0)}
          </span>
        ),
      },
      {
        id: "points_pct", accessor: "points_pct", header: "SP %", minWidth: 90, alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const pct = Number(value) || 0;
          const notStarted = pct < 5;
          const color = notStarted ? undefined : pct >= 80 ? Colors.Charts.Apdex.Good.Default : pct >= 60 ? Colors.Charts.Apdex.Fair.Default : Colors.Charts.Apdex.Poor.Default;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color, fontWeight: 600, opacity: notStarted ? 0.35 : 1 }}>
              {pct.toFixed(0)}%
            </span>
          );
        },
      },
    ],
    [currentSprintIdx],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Sprint Commitment vs Delivery (6 months)</Heading>
        <QueryInspector query={query} title="Sprint Commitment — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Stories assigned to each sprint vs stories closed. The CURRENT badge marks the active sprint. Sprints with fewer than 20 stories are filtered out. Delivery % above 80% indicates healthy commitment sizing.
      </Paragraph>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      ) : empty("No sprint data available")}
    </>,
  );
}

/* ── Monthly predictability trend ───────────────────── */
function PredictabilityTrend() {
  const { capability } = useCapability();
  const query = predictabilityTrendQuery(capability);
  const { data, isLoading } = useDql({ query });

  const chartData = useMemo(() => {
    return (data?.records ?? []).map((r) => ({
      category: String(r.month ?? ""),
      value: Number(r.churn_pct) || 0,
    }));
  }, [data]);

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Fix Version Churn Rate (12-month trend)</Heading>
        <QueryInspector query={query} title="FV Churn Rate — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        % of active VIs whose fix version changed each month. Lower is better — declining trend means improving predictability.
      </Paragraph>
      {isLoading ? loading() : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData}>
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No trend data available")}
    </>,
  );
}

/* ── Recent fixVersion changes ──────────────────────── */
function RecentFixVersionChanges() {
  const { capability } = useCapability();
  const query = fixVersionChangesExpandedQuery(capability);
  const { data, isLoading } = useDql({ query });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "key", accessor: "key", header: "Key", minWidth: 120,
        cell: ({ value }: { value: unknown }) => (
          <a href={jiraUrl(String(value ?? ""))} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600, textDecoration: "none", color: "inherit" }}>
            {String(value ?? "")} ↗
          </a>
        ),
      },
      { id: "summary", accessor: "summary", header: "Summary", minWidth: 260 },
      { id: "latest_status", accessor: "latest_status", header: "Status", minWidth: 140 },
      {
        id: "earliest_fv", accessor: "earliest_fv", header: "Previous Fix Version", minWidth: 150,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%", color: Colors.Charts.Apdex.Poor.Default }}>
            {String(value ?? "None")}
          </span>
        ),
      },
      {
        id: "latest_fv", accessor: "latest_fv", header: "Current Fix Version", minWidth: 150,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600 }}>
            {String(value ?? "None")}
          </span>
        ),
      },
      {
        id: "latest_target", accessor: "latest_target", header: "Target End", minWidth: 120,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {value ? String(value).substring(0, 10) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Fix Version Changes (last 7 days, in-flight VIs)</Heading>
        <QueryInspector query={query} title="FV Changes (7d) — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>VIs in Implementation+ whose fixVersion changed between daily snapshots. Includes target end date.</Paragraph>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data?.records ?? []} columns={columns} sortable resizable />
      ) : empty("No fixVersion changes detected — good stability!")}
    </>,
  );
}

/* ── 30-day fixVersion stability ────────────────────── */
function FixVersionStability() {
  const { capability } = useCapability();
  const query = fixVersionStability30dQuery(capability);
  const { data, isLoading } = useDql({ query });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "key", accessor: "key", header: "Key", minWidth: 120,
        cell: ({ value }: { value: unknown }) => (
          <a href={jiraUrl(String(value ?? ""))} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600, textDecoration: "none", color: "inherit" }}>
            {String(value ?? "")} ↗
          </a>
        ),
      },
      { id: "summary", accessor: "summary", header: "Summary", minWidth: 260 },
      { id: "latest_status", accessor: "latest_status", header: "Status", minWidth: 140 },
      {
        id: "version_changes", accessor: "version_changes", header: "Version Changes", minWidth: 130, alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const n = Number(value) || 0;
          const color = n >= 3 ? Colors.Charts.Apdex.Unacceptable.Default : n >= 2 ? Colors.Charts.Apdex.Poor.Default : undefined;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color, fontWeight: n >= 3 ? 700 : 400 }}>
              {n}
            </span>
          );
        },
      },
    ],
    [],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Fix Version Instability (30 days)</Heading>
        <QueryInspector query={query} title="FV Instability (30d) — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>VIs that had multiple different fixVersions over the past 30 days.</Paragraph>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      ) : empty("All VIs have stable fix versions — great predictability!")}
    </>,
  );
}

/* ── Target date drift ──────────────────────────────── */
function TargetDateDrift() {
  const { capability } = useCapability();
  const query = targetDateDriftQuery(capability);
  const { data, isLoading } = useDql({ query });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "key", accessor: "key", header: "Key", minWidth: 120,
        cell: ({ value }: { value: unknown }) => (
          <a href={jiraUrl(String(value ?? ""))} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600, textDecoration: "none", color: "inherit" }}>
            {String(value ?? "")} ↗
          </a>
        ),
      },
      { id: "summary", accessor: "summary", header: "Summary", minWidth: 260 },
      { id: "latest_status", accessor: "latest_status", header: "Status", minWidth: 140 },
      {
        id: "date_changes", accessor: "date_changes", header: "Date Changes", minWidth: 120, alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const n = Number(value) || 0;
          const color = n >= 3 ? Colors.Charts.Apdex.Unacceptable.Default : n >= 2 ? Colors.Charts.Apdex.Poor.Default : undefined;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color, fontWeight: n >= 3 ? 700 : 400 }}>
              {n}
            </span>
          );
        },
      },
    ],
    [],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Target Date Drift (30 days)</Heading>
        <QueryInspector query={query} title="Target Date Drift — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>VIs whose target end date changed while in implementation.</Paragraph>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      ) : empty("No target date drift — delivery is predictable!")}
    </>,
  );
}

/* ── Delivery by fix version ────────────────────────── */
function DeliveryByVersion() {
  const { capability } = useCapability();
  const query = deliveryAccuracyQuery(capability);
  const { data, isLoading } = useDql({ query });
  const { data: unplannedData, isLoading: unplannedLoading } = useDql({ query: unplannedVisQuery(capability) });
  const [showUnplanned, setShowUnplanned] = useState(false);

  const chartData = useMemo(
    () => {
      const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      const parsed = (data?.records ?? []).map((r) => {
        const name = String(r.fixVersions ?? "Unset");
        const parts = name.match(/^(\w+)\s+(\d{4})$/);
        const sortKey = parts ? Number(parts[2]) * 12 + (MONTHS[parts[1]] ?? 0) : -1;
        return { category: name, value: Number(r.vi_count) || 0, sortKey };
      });
      return parsed.sort((a, b) => b.sortKey - a.sortKey);
    },
    [data],
  );

  const unplannedRecs = unplannedData?.records ?? [];

  const unplannedCols: Col[] = useMemo(
    () => [
      {
        id: "key", accessor: "key", header: "Key", minWidth: 120,
        cell: ({ value }: { value: unknown }) => (
          <a href={jiraUrl(String(value ?? ""))} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600, textDecoration: "none", color: "inherit" }}>
            {String(value ?? "")} ↗
          </a>
        ),
      },
      { id: "summary", accessor: "summary", header: "Summary", minWidth: 280 },
      { id: "fixVersions", accessor: "fixVersions", header: "Fix Version", minWidth: 150 },
      {
        id: "resolutiondate", accessor: "resolutiondate", header: "Resolved", minWidth: 110,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {value ? String(value).substring(0, 10) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return card(
    <>
      <Flex justifyContent="space-between" alignItems="center">
        <Flex gap={8} alignItems="center">
          <Heading level={4}>Closed VIs by Fix Version (12 months)</Heading>
          <QueryInspector query={query} title="Delivery Accuracy — DQL" />
        </Flex>
        <button
          onClick={() => setShowUnplanned(!showUnplanned)}
          style={{
            padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
            borderRadius: 6, border: `1px solid ${Colors.Charts.Apdex.Fair.Default}`,
            color: Colors.Charts.Apdex.Fair.Default, background: "transparent",
          }}
        >
          {showUnplanned ? "Hide Unplanned" : `Show Unplanned (${unplannedRecs.length})`}
        </button>
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Planned deliveries only. Click "Show Unplanned" to see VIs tagged as unplanned.</Paragraph>
      {isLoading ? loading() : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData} layout="horizontal">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No data")}
      {showUnplanned && (
        <Flex flexDirection="column" gap={8} style={{ marginTop: 8 }}>
          <Heading level={5} style={{ color: Colors.Charts.Apdex.Fair.Default }}>Unplanned VIs</Heading>
          {unplannedLoading ? loading() : unplannedRecs.length > 0 ? (
            <DataTable data={unplannedRecs} columns={unplannedCols} sortable resizable>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          ) : empty("No unplanned VIs found")}
        </Flex>
      )}
    </>,
  );
}

/* ── Page ────────────────────────────────────────────── */
export const Predictability = () => {
  const { capability } = useCapability();
  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <Heading level={2}>Pillar 3: Predictability</Heading>
      <Paragraph style={{ opacity: 0.6 }}>
        How often do delivery commitments shift? Tracking fix version stability and target date drift for {capability.label}.
      </Paragraph>
      <PredictabilityTrend />
      <SprintCommitment />
      <RecentFixVersionChanges />
      <FixVersionStability />
      <TargetDateDrift />
      <DeliveryByVersion />
    </Flex>
  );
};
