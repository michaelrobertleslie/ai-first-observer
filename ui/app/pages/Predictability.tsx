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
} from "../queries";

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

/* ── Monthly predictability trend ───────────────────── */
function PredictabilityTrend() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: predictabilityTrendQuery(capability) });

  const chartData = useMemo(() => {
    return (data?.records ?? []).map((r) => ({
      category: String(r.month ?? ""),
      value: Number(r.churn_pct) || 0,
    }));
  }, [data]);

  return card(
    <>
      <Heading level={4}>Fix Version Churn Rate (12-month trend)</Heading>
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
  const { data, isLoading } = useDql({ query: fixVersionChangesExpandedQuery(capability) });

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
      <Heading level={4}>Fix Version Changes (last 7 days, in-flight VIs)</Heading>
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
  const { data, isLoading } = useDql({ query: fixVersionStability30dQuery(capability) });

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
      <Heading level={4}>Fix Version Instability (30 days)</Heading>
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
  const { data, isLoading } = useDql({ query: targetDateDriftQuery(capability) });

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
      <Heading level={4}>Target Date Drift (30 days)</Heading>
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
  const { data, isLoading } = useDql({ query: deliveryAccuracyQuery(capability) });
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
        <Heading level={4}>Closed VIs by Fix Version (12 months)</Heading>
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
      <RecentFixVersionChanges />
      <FixVersionStability />
      <TargetDateDrift />
      <DeliveryByVersion />
    </Flex>
  );
};
