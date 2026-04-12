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

/* ── Cycle time trend (chart) ───────────────────────── */
function CycleTimeTrend() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: viCycleTimeTrendQuery(capability) });

  const avgData = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.month ?? ""),
      value: Math.round(Number(r.avg_cycle) || 0),
    })),
    [data],
  );

  const p50Data = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.month ?? ""),
      value: Math.round(Number(r.p50_cycle) || 0),
    })),
    [data],
  );

  return card(
    <>
      <Heading level={4}>Cycle Time Trend (monthly)</Heading>
      {isLoading ? loading() : avgData.length > 0 ? (
        <Flex flexDirection="column" gap={16}>
          <Flex flexDirection="column" gap={4}>
            <Paragraph style={{ fontSize: 11, fontWeight: 600 }}>Average Cycle Time (days)</Paragraph>
            <CategoricalBarChart data={avgData} layout="vertical">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Paragraph style={{ fontSize: 11, fontWeight: 600 }}>Median (p50) Cycle Time (days)</Paragraph>
            <CategoricalBarChart data={p50Data} layout="vertical">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          </Flex>
        </Flex>
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
