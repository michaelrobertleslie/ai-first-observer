import React, { useMemo, useState } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { useCapability } from "../CapabilityContext";
import { jiraUrl, jiraSearchUrl } from "../config";
import {
  viThroughputTrendQuery,
  viCycleTimeQuery,
  viCycleTimeDetailQuery,
  viCycleTimeTrendQuery,
  viPipelineQuery,
  viQuarterlyThroughputQuery,
  storyPointsPerViQuery,
} from "../queries";
import { QueryInspector } from "../components/QueryInspector";

type ResultRecord = Record<string, unknown>;
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

/* ── Headline KPIs ──────────────────────────────────── */
function ProductivityKpis() {
  const { capability } = useCapability();
  const cycle = useDql({ query: viCycleTimeQuery(capability) });
  const quarterly = useDql({ query: viQuarterlyThroughputQuery(capability) });

  const rec = cycle.data?.records?.[0];
  const qRecs = quarterly.data?.records ?? [];

  // Quarter-over-quarter comparison
  const latestQ = qRecs.length > 0 ? Number(qRecs[qRecs.length - 1]?.vi_count) || 0 : 0;
  const prevQ = qRecs.length > 1 ? Number(qRecs[qRecs.length - 2]?.vi_count) || 0 : 0;
  const qoqPct = prevQ > 0 ? ((latestQ - prevQ) / prevQ * 100) : 0;

  // YoY: compare latest 4 quarters to previous 4
  const last4 = qRecs.slice(-4).reduce((s, r) => s + (Number(r.vi_count) || 0), 0);
  const prev4 = qRecs.slice(-8, -4).reduce((s, r) => s + (Number(r.vi_count) || 0), 0);
  const yoyPct = prev4 > 0 ? ((last4 - prev4) / prev4 * 100) : 0;

  // Current calendar quarter start (for JQL link)
  const now = new Date();
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const qStartStr = qStart.toISOString().substring(0, 10);
  const latestQLabel = qRecs.length > 0 ? String(qRecs[qRecs.length - 1]?.quarter_label ?? "") : "";

  const anyLoading = cycle.isLoading || quarterly.isLoading;

  const kpis = [
    { label: "VIs Closed (12 mo)", value: rec ? String(rec.total_closed) : "—", color: Colors.Charts.Apdex.Excellent.Default, href: jiraSearchUrl(`"owning Program" = "${capability.viProgram}" AND type = ValueIncrement AND status = Closed AND resolved >= -365d ORDER BY resolved DESC`) },
    { label: "Median Cycle Time", value: rec ? `${Math.round(Number(rec.p50_days))}d` : "—", color: Number(rec?.p50_days) > 90 ? Colors.Charts.Apdex.Poor.Default : Colors.Charts.Apdex.Good.Default, href: jiraSearchUrl(`"owning Program" = "${capability.viProgram}" AND type = ValueIncrement AND status = Closed AND resolved >= -365d ORDER BY resolved DESC`) },
    { label: `Latest Quarter (${latestQLabel})`, value: `${latestQ} VIs`, color: qoqPct > 0 ? Colors.Charts.Apdex.Excellent.Default : Colors.Charts.Apdex.Poor.Default, sub: `${qoqPct >= 0 ? "+" : ""}${qoqPct.toFixed(0)}% QoQ`, href: jiraSearchUrl(`"owning Program" = "${capability.viProgram}" AND type = ValueIncrement AND status = Closed AND resolved >= "${qStartStr}" ORDER BY resolved DESC`) },
    { label: "Year-over-Year", value: `${yoyPct >= 0 ? "+" : ""}${yoyPct.toFixed(0)}%`, color: yoyPct > 0 ? Colors.Charts.Apdex.Excellent.Default : Colors.Charts.Apdex.Poor.Default, sub: `${last4} vs ${prev4} VIs`, href: jiraSearchUrl(`"owning Program" = "${capability.viProgram}" AND type = ValueIncrement AND status = Closed ORDER BY resolved DESC`) },
  ];

  return (
    <Flex gap={16} flexFlow="wrap" style={{ width: "100%" }}>
      {anyLoading ? <Flex justifyContent="center" padding={48} style={{ width: "100%" }}><ProgressCircle /></Flex> : kpis.map(({ label, value, color, sub, href }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ flex: "1 1 200px", minWidth: 200, textDecoration: "none", color: "inherit" }}>
          <Surface style={{ height: "100%", borderTop: `3px solid ${color}`, cursor: "pointer" }}>
            <Flex flexDirection="column" gap={4} padding={20} alignItems="center">
              <Paragraph style={{ opacity: 0.5, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{label}</Paragraph>
              <Heading level={2} style={{ color }}>{value}</Heading>
              {sub && <Paragraph style={{ opacity: 0.5, fontSize: 11 }}>{sub}</Paragraph>}
              <Paragraph style={{ opacity: 0.3, fontSize: 10 }}>View in Jira ↗</Paragraph>
            </Flex>
          </Surface>
        </a>
      ))}
    </Flex>
  );
}

/* ── Quarterly throughput comparison ─────────────────── */
function QuarterlyThroughput() {
  const { capability } = useCapability();
  const query = viQuarterlyThroughputQuery(capability);
  const { data, isLoading } = useDql({ query });

  const chartData = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.quarter_label ?? ""),
      value: Number(r.vi_count) || 0,
    })),
    [data],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Quarterly VI Throughput</Heading>
        <QueryInspector query={query} title="Quarterly VI Throughput — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>VIs closed per quarter — the core AI-First productivity metric. Are we accelerating?</Paragraph>
      {isLoading ? loading() : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData} layout="vertical">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No data")}
    </>,
  );
}

/* ── Monthly throughput chart ───────────────────────── */
function ThroughputTrend() {
  const { capability } = useCapability();
  const query = viThroughputTrendQuery(capability);
  const { data, isLoading } = useDql({ query });

  const chartData = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.month ?? ""),
      value: Number(r.vi_count) || 0,
    })),
    [data],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Monthly VI Throughput (12 months)</Heading>
        <QueryInspector query={query} title="Monthly VI Throughput — DQL" />
      </Flex>
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
  const query = viCycleTimeQuery(capability);
  const detailQuery = viCycleTimeDetailQuery(capability);
  const { data, isLoading } = useDql({ query });
  const { data: detailData, isLoading: detailLoading } = useDql({ query: detailQuery });
  const [showDetail, setShowDetail] = useState(false);
  const rec = data?.records?.[0];
  const detailRecords = detailData?.records ?? [];

  const detailColumns: Col[] = useMemo(
    () => [
      {
        id: "key", accessor: "key", header: "Key", minWidth: 130,
        cell: ({ value }: { value: unknown }) => (
          <a href={jiraUrl(String(value ?? ""))} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600, textDecoration: "none", color: "inherit" }}>
            {String(value ?? "")} ↗
          </a>
        ),
      },
      { id: "summary", accessor: "summary", header: "Summary", minWidth: 300 },
      {
        id: "created", accessor: "created", header: "Created", minWidth: 110,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {value ? String(value).substring(0, 10) : "—"}
          </span>
        ),
      },
      {
        id: "resolutiondate", accessor: "resolutiondate", header: "Resolved", minWidth: 110,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {value ? String(value).substring(0, 10) : "—"}
          </span>
        ),
      },
      {
        id: "cycle_days", accessor: "cycle_days", header: "Cycle (days)", minWidth: 110,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", fontWeight: 600 }}>
            {Math.round(Number(value))}
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
          <Heading level={4}>Cycle Time (created → closed)</Heading>
          <QueryInspector query={query} title="Cycle Time Summary — DQL" />
        </Flex>
        <button
          onClick={() => setShowDetail(!showDetail)}
          style={{
            padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
            borderRadius: 6, border: `1px solid ${Colors.Charts.Apdex.Good.Default}`,
            color: Colors.Charts.Apdex.Good.Default, background: "transparent",
          }}
        >
          {showDetail ? "Hide Detail" : `Show All VIs (${detailRecords.length})`}
        </button>
      </Flex>
      {isLoading ? loading() : rec ? (
        <Flex flexDirection="column" gap={16}>
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
          <Surface style={{ borderLeft: `3px solid ${Colors.Charts.Apdex.Fair.Default}`, padding: 16 }}>
            <Flex flexDirection="column" gap={8}>
              <Paragraph style={{ fontSize: 12, fontWeight: 600 }}>How this is calculated</Paragraph>
              <Paragraph style={{ opacity: 0.6, fontSize: 12 }}>
                Cycle time = days from Jira <strong>created</strong> date to <strong>resolution</strong> date for each VI (Value Increment)
                closed in the last 12 months. VIs are large strategic items — many are created months or years before
                implementation starts, so this metric reflects total backlog-to-delivery time, not implementation duration.
              </Paragraph>
              <Paragraph style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Verification</Paragraph>
              <Paragraph style={{ opacity: 0.6, fontSize: 12, fontFamily: "monospace", lineHeight: 1.8 }}>
                {Number(rec.total_closed)} closed VIs, each with cycle_days = (resolved − created) / 86400s<br />
                Sorted ascending → <strong>median (p50)</strong> = value at position {Math.ceil(Number(rec.total_closed) * 0.5)} of {Number(rec.total_closed)} = <strong>{Math.round(Number(rec.p50_days))} days</strong><br />
                Mean = sum of all cycle_days / {Number(rec.total_closed)} = <strong>{Math.round(Number(rec.avg_days))} days</strong><br />
                p90 = value at position {Math.ceil(Number(rec.total_closed) * 0.9)} of {Number(rec.total_closed)} = <strong>{Math.round(Number(rec.p90_days))} days</strong>
              </Paragraph>
              <Paragraph style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Full distribution (closed VIs, last 12 months)</Paragraph>
              <Flex gap={16} flexFlow="wrap">
                {[
                  { label: "Min", value: rec.min_days },
                  { label: "p10", value: rec.p10_days },
                  { label: "p25", value: rec.p25_days },
                  { label: "p50 (median)", value: rec.p50_days },
                  { label: "p75", value: rec.p75_days },
                  { label: "p90", value: rec.p90_days },
                  { label: "Max", value: rec.max_days },
                ].map(({ label, value }) => (
                  <Flex key={label} flexDirection="column" alignItems="center" gap={2}>
                    <Paragraph style={{ opacity: 0.5, fontSize: 11 }}>{label}</Paragraph>
                    <Paragraph style={{ fontWeight: 600, fontSize: 13 }}>{Math.round(Number(value))}d</Paragraph>
                  </Flex>
                ))}
              </Flex>
            </Flex>
          </Surface>
        </Flex>
      ) : empty("No data")}
      {showDetail && (
        <Flex flexDirection="column" gap={8} style={{ marginTop: 8 }}>
          <Heading level={5} style={{ color: Colors.Charts.Apdex.Good.Default }}>Individual VIs (sorted by cycle time)</Heading>
          {detailLoading ? loading() : detailRecords.length > 0 ? (
            <DataTable data={detailRecords} columns={detailColumns} sortable resizable>
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          ) : empty("No data")}
        </Flex>
      )}
    </>,
  );
}

/* ── Cycle time trend (chart) ───────────────────────── */
function CycleTimeTrend() {
  const { capability } = useCapability();
  const query = viCycleTimeTrendQuery(capability);
  const { data, isLoading } = useDql({ query });

  const p50Data = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.month ?? ""),
      value: Math.round(Number(r.p50_cycle) || 0),
    })),
    [data],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Median Cycle Time Trend (monthly)</Heading>
        <QueryInspector query={query} title="Cycle Time Trend — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Lower is better. AI-First should compress cycle times over time.</Paragraph>
      {isLoading ? loading() : p50Data.length > 0 ? (
        <CategoricalBarChart data={p50Data} layout="vertical">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No data")}
    </>,
  );
}

/* ── Story points per month (guard rail) ────────────── */
function StoryPointsTrend() {
  const { capability } = useCapability();
  const query = storyPointsPerViQuery(capability);
  const { data, isLoading } = useDql({ query });

  const chartData = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.month ?? ""),
      value: Math.round(Number(r.total_points) || 0),
    })),
    [data],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Story Points Delivered (monthly)</Heading>
        <QueryInspector query={query} title="Story Points Delivered — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Guard rail: if VIs increase but story points don't, we may be inflating VI count rather than delivering real value.</Paragraph>
      {isLoading ? loading() : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData} layout="vertical">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No data")}
    </>,
  );
}

/* ── Pipeline status ────────────────────────────────── */
function Pipeline() {
  const { capability } = useCapability();
  const query = viPipelineQuery(capability);
  const { data, isLoading } = useDql({ query });

  const chartData = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.status ?? ""),
      value: Number(r.count) || 0,
    })),
    [data],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Current VI Pipeline (excl. Cancelled)</Heading>
        <QueryInspector query={query} title="VI Pipeline — DQL" />
      </Flex>
      {isLoading ? loading() : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData} layout="horizontal">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No active VIs")}
    </>,
  );
}

/* ── Context: Industry benchmarks ───────────────────── */
function IndustryContext() {
  return (
    <Surface style={{ width: "100%", borderLeft: `3px solid ${Colors.Charts.Apdex.Fair.Default}` }}>
      <Flex flexDirection="column" gap={8} padding={20}>
        <Heading level={5}>Industry Context: AI-First Productivity</Heading>
        <Paragraph style={{ opacity: 0.6, fontSize: 12 }}>
          Leading companies report 20–40% developer productivity gains from AI coding assistants (Google, Microsoft, Atlassian).
          Key metrics tracked industry-wide: <strong>throughput</strong> (features shipped per quarter),
          <strong> cycle time</strong> (idea to production), <strong>code velocity</strong> (PRs merged/week),
          and <strong>developer satisfaction</strong>. McKinsey's developer productivity framework emphasizes
          measuring both speed and quality — shipping faster only counts if defect rates don't rise.
        </Paragraph>
      </Flex>
    </Surface>
  );
}

/* ── Page ────────────────────────────────────────────── */
export const UnlockValue = () => {
  const { capability } = useCapability();
  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <Heading level={2}>Pillar 1: Unlock Value</Heading>
      <Paragraph style={{ opacity: 0.6 }}>
        The flagship AI-First metric: are we delivering more valuable features, faster?
        Tracking VI throughput, cycle time trends, and delivery velocity for {capability.label}.
      </Paragraph>
      <ProductivityKpis />
      <QuarterlyThroughput />
      <ThroughputTrend />
      <CycleTimeSummary />
      <CycleTimeTrend />
      <StoryPointsTrend />
      <Pipeline />
      <IndustryContext />
    </Flex>
  );
};
