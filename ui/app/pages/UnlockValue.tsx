import React, { useMemo } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import type { ResultRecord } from "@dynatrace-sdk/client-query";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { useCapability } from "../CapabilityContext";
import {
  viThroughputTrendQuery,
  viCycleTimeQuery,
  viCycleTimeTrendQuery,
  viPipelineQuery,
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

/* ── Throughput chart ───────────────────────────────── */
function ThroughputTrend() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: viThroughputTrendQuery(capability) });

  const chartData = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.month ?? ""),
      value: Number(r.vi_count) || 0,
    })),
    [data],
  );

  return card(
    <>
      <Heading level={4}>VI Throughput (closed per month, 12 months)</Heading>
      {isLoading ? loading() : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData} layout="vertical">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No closed VIs")}
    </>,
  );
}

/* ── Cycle time summary ─────────────────────────────── */
function CycleTimeSummary() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: viCycleTimeQuery(capability) });
  const rec = data?.records?.[0];

  return card(
    <>
      <Heading level={4}>Cycle Time (created → closed)</Heading>
      {isLoading ? loading() : rec ? (
        <Flex gap={32} flexFlow="wrap">
          {[
            { label: "Average", value: `${Math.round(Number(rec.avg_days))} days` },
            { label: "Median (p50)", value: `${Math.round(Number(rec.p50_days))} days` },
            { label: "p90", value: `${Math.round(Number(rec.p90_days))} days` },
            { label: "Total closed", value: String(rec.total_closed) },
          ].map(({ label, value }) => (
            <Flex key={label} flexDirection="column" alignItems="center" gap={4}>
              <Paragraph style={{ opacity: 0.6, fontSize: 12 }}>{label}</Paragraph>
              <Heading level={3}>{value}</Heading>
            </Flex>
          ))}
        </Flex>
      ) : empty("No data")}
    </>,
  );
}

/* ── Cycle time trend ───────────────────────────────── */
function CycleTimeTrend() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: viCycleTimeTrendQuery(capability) });

  const columns: Col[] = useMemo(
    () => [
      { id: "month", accessor: "month", header: "Month", minWidth: 100 },
      { id: "vi_count", accessor: "vi_count", header: "VIs Closed", minWidth: 90, alignment: "right" as const },
      {
        id: "avg_cycle", accessor: "avg_cycle", header: "Avg Cycle (days)", minWidth: 130, alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Math.round(Number(value) || 0)}
          </span>
        ),
      },
      {
        id: "p50_cycle", accessor: "p50_cycle", header: "p50 (days)", minWidth: 110, alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            {Math.round(Number(value) || 0)}
          </span>
        ),
      },
    ],
    [],
  );

  return card(
    <>
      <Heading level={4}>Cycle Time Trend (monthly)</Heading>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data?.records ?? []} columns={columns} sortable resizable />
      ) : empty("No data")}
    </>,
  );
}

/* ── Pipeline status ────────────────────────────────── */
function Pipeline() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: viPipelineQuery(capability) });

  const chartData = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.status ?? ""),
      value: Number(r.count) || 0,
    })),
    [data],
  );

  return card(
    <>
      <Heading level={4}>Current VI Pipeline (excl. Cancelled)</Heading>
      {isLoading ? loading() : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData} layout="horizontal">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No active VIs")}
    </>,
  );
}

/* ── Page ────────────────────────────────────────────── */
export const UnlockValue = () => {
  const { capability } = useCapability();
  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <Heading level={2}>Pillar 1: Unlock Value</Heading>
      <Paragraph style={{ opacity: 0.6 }}>
        Are we delivering more valuable features, faster? Tracking VI throughput and cycle time for {capability.label}.
      </Paragraph>
      <CycleTimeSummary />
      <ThroughputTrend />
      <CycleTimeTrend />
      <Pipeline />
    </Flex>
  );
};
