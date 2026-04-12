import React, { useMemo } from "react";
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
import {
  fixVersionChangesQuery,
  fixVersionStability30dQuery,
  targetDateDriftQuery,
  deliveryAccuracyQuery,
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

/* ── Recent fixVersion changes ──────────────────────── */
function RecentFixVersionChanges() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: fixVersionChangesQuery(capability) });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "key", accessor: "key", header: "Key", minWidth: 120,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600 }}>{String(value ?? "")}</span>
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
    ],
    [],
  );

  return card(
    <>
      <Heading level={4}>Fix Version Changes (last 48h, in-flight VIs)</Heading>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>VIs in Implementation+ whose fixVersion changed between daily snapshots.</Paragraph>
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
          <span style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600 }}>{String(value ?? "")}</span>
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
          <span style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600 }}>{String(value ?? "")}</span>
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

  const chartData = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.fixVersions ?? "Unset"),
      value: Number(r.vi_count) || 0,
    })),
    [data],
  );

  return card(
    <>
      <Heading level={4}>Closed VIs by Fix Version (12 months)</Heading>
      {isLoading ? loading() : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData} layout="horizontal">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No data")}
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
      <RecentFixVersionChanges />
      <FixVersionStability />
      <TargetDateDrift />
      <DeliveryByVersion />
    </Flex>
  );
};
