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
import { scorecardUrl, jiraUrl } from "../config";
import {
  derRollingQuarterQuery,
  derSplitTrendQuery,
  derCustomerSplitRollingQuery,
  prodBugsByComponentQuery,
  recentProdBugsQuery,
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

/* ── DER overview with customer-escalation split ────── */
function DerSummary() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: derRollingQuarterQuery(capability) });
  const { data: splitData, isLoading: splitLoading } = useDql({ query: derCustomerSplitRollingQuery(capability) });

  const records = data?.records ?? [];
  const total = records.reduce((s, r) => s + (Number(r.bug_count) || 0), 0);
  const prod = Number(records.find((r) => r["Found in"] === "PRODUCTION")?.bug_count) || 0;
  const derPct = total > 0 ? (100 * prod / total) : 0;

  const splitRecs = splitData?.records ?? [];
  const custBugs = Number(splitRecs.find((r) => r.source === "Customer-Escalated")?.bug_count) || 0;
  const intBugs = Number(splitRecs.find((r) => r.source === "Internally Discovered")?.bug_count) || 0;
  const custDerPct = total > 0 ? (100 * custBugs / total) : 0;
  const intDerPct = total > 0 ? (100 * intBugs / total) : 0;

  const stageChart = useMemo(
    () => records.map((r) => ({
      category: String(r["Found in"] ?? "Unknown"),
      value: Number(r.bug_count) || 0,
    })),
    [records],
  );

  const splitChart = useMemo(
    () => splitRecs.map((r) => ({
      category: String(r.source ?? "Unknown"),
      value: Number(r.bug_count) || 0,
    })),
    [splitRecs],
  );

  const anyLoad = isLoading || splitLoading;

  return (
    <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
      {/* Overall DER card */}
      <Surface style={{ flex: "0 0 200px" }}>
        <Flex flexDirection="column" gap={6} padding={24} alignItems="center">
          <Paragraph style={{ opacity: 0.5, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Overall DER (90d)</Paragraph>
          {anyLoad ? <ProgressCircle /> : (
            <>
              <Heading level={1} style={{ color: derPct > 20 ? Colors.Charts.Apdex.Unacceptable.Default : derPct > 5 ? Colors.Charts.Apdex.Poor.Default : Colors.Charts.Apdex.Good.Default }}>
                {derPct.toFixed(1)}%
              </Heading>
              <Paragraph style={{ opacity: 0.5, fontSize: 11 }}>{prod.toLocaleString()} / {total.toLocaleString()} bugs</Paragraph>
              <Paragraph style={{ opacity: 0.35, fontSize: 10 }}>Target: &lt; 5%</Paragraph>
            </>
          )}
        </Flex>
      </Surface>

      {/* Customer DER card */}
      <Surface style={{ flex: "0 0 200px", borderTop: `3px solid ${Colors.Charts.Apdex.Unacceptable.Default}` }}>
        <Flex flexDirection="column" gap={6} padding={24} alignItems="center">
          <Paragraph style={{ opacity: 0.5, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Customer-Escalated</Paragraph>
          {anyLoad ? <ProgressCircle /> : (
            <>
              <Heading level={2} style={{ color: custDerPct > 5 ? Colors.Charts.Apdex.Unacceptable.Default : Colors.Charts.Apdex.Fair.Default }}>
                {custDerPct.toFixed(1)}%
              </Heading>
              <Paragraph style={{ opacity: 0.5, fontSize: 11 }}>{custBugs} bugs (Support-triggered)</Paragraph>
            </>
          )}
        </Flex>
      </Surface>

      {/* Internal DER card */}
      <Surface style={{ flex: "0 0 200px", borderTop: `3px solid ${Colors.Charts.Apdex.Fair.Default}` }}>
        <Flex flexDirection="column" gap={6} padding={24} alignItems="center">
          <Paragraph style={{ opacity: 0.5, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Internal Production</Paragraph>
          {anyLoad ? <ProgressCircle /> : (
            <>
              <Heading level={2} style={{ color: Colors.Charts.Apdex.Fair.Default }}>
                {intDerPct.toFixed(1)}%
              </Heading>
              <Paragraph style={{ opacity: 0.5, fontSize: 11 }}>{intBugs} bugs (internally found)</Paragraph>
            </>
          )}
        </Flex>
      </Surface>

      {/* Discovery stage chart */}
      <Surface style={{ flex: "1 1 300px", minWidth: 280 }}>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Heading level={5}>Bugs by Discovery Stage</Heading>
          {anyLoad ? loading() : stageChart.length > 0 ? (
            <CategoricalBarChart data={stageChart} layout="horizontal">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          ) : empty("No data")}
        </Flex>
      </Surface>

      {/* Customer split chart */}
      <Surface style={{ flex: "1 1 300px", minWidth: 280 }}>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Heading level={5}>Production Bug Source</Heading>
          {anyLoad ? loading() : splitChart.length > 0 ? (
            <CategoricalBarChart data={splitChart} layout="horizontal">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          ) : empty("No data")}
        </Flex>
      </Surface>
    </Flex>
  );
}

/* ── DER trend chart (replaces table) ───────────────── */
function DerTrend() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: derSplitTrendQuery(capability) });

  const chartData = useMemo(() => {
    const recs = data?.records ?? [];
    return recs.map((r) => ({
      category: String(r.month ?? ""),
      value: Number(r.der_pct) || 0,
    }));
  }, [data]);

  const custChartData = useMemo(() => {
    const recs = data?.records ?? [];
    return recs.map((r) => ({
      category: String(r.month ?? ""),
      value: Number(r.customer_der_pct) || 0,
    }));
  }, [data]);

  return card(
    <>
      <Heading level={4}>DER Trend (monthly, 12 months)</Heading>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Overall DER % and customer-escalated DER % per month.</Paragraph>
      {isLoading ? loading() : chartData.length > 0 ? (
        <Flex flexDirection="column" gap={16}>
          <Flex flexDirection="column" gap={4}>
            <Paragraph style={{ fontSize: 11, fontWeight: 600 }}>Overall DER %</Paragraph>
            <CategoricalBarChart data={chartData} layout="vertical">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Paragraph style={{ fontSize: 11, fontWeight: 600 }}>Customer-Escalated DER %</Paragraph>
            <CategoricalBarChart data={custChartData} layout="vertical">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          </Flex>
        </Flex>
      ) : empty("No data")}
    </>,
  );
}

/* ── Production bugs by component ───────────────────── */
function ProdBugsByComponent() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: prodBugsByComponentQuery(capability) });

  const chartData = useMemo(
    () => (data?.records ?? []).map((r) => ({
      category: String(r.components_array ?? "Unset"),
      value: Number(r.bug_count) || 0,
    })),
    [data],
  );

  return card(
    <>
      <Heading level={4}>Production Bugs by Component (12 months)</Heading>
      {isLoading ? loading() : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData} layout="horizontal">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : empty("No data")}
    </>,
  );
}

/* ── Recent production bugs table ───────────────────── */
function RecentProdBugs() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: recentProdBugsQuery(capability) });

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
      {
        id: "source", accessor: "Support-triggered", header: "Source", minWidth: 130,
        cell: ({ value }: { value: unknown }) => {
          const isCust = String(value) === "true";
          const color = isCust ? Colors.Charts.Apdex.Unacceptable.Default : Colors.Charts.Apdex.Fair.Default;
          const label = isCust ? "Customer" : "Internal";
          return (
            <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                border: `1px solid ${color}`, color,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                {label}
              </span>
            </span>
          );
        },
      },
      { id: "summary", accessor: "summary", header: "Summary", minWidth: 280 },
      { id: "status", accessor: "status", header: "Status", minWidth: 110 },
      { id: "components_array", accessor: "components_array", header: "Component", minWidth: 140 },
      { id: "assignee", accessor: "assignee", header: "Assignee", minWidth: 140 },
      {
        id: "created", accessor: "created", header: "Created", minWidth: 100,
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
      <Heading level={4}>Recent Production Bugs (90 days)</Heading>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      ) : empty("No production bugs in last 90 days")}
    </>,
  );
}

/* ── Component Scorecards ───────────────────────────── */
function Scorecards() {
  const { capability } = useCapability();
  const assets = capability.scorecardAssets ?? [];
  const links = capability.junoLinks ?? [];
  if (assets.length === 0 && links.length === 0) return null;

  return card(
    <>
      <Heading level={4}>Component Scorecards</Heading>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Quality dashboards and Juno catalog pages for {capability.label} components.</Paragraph>
      <Flex gap={8} flexFlow="wrap">
        {assets.map(({ label, asset }) => (
          <a key={asset} href={scorecardUrl(asset)} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", fontSize: 12, fontWeight: 500, borderRadius: 6, border: `1px solid ${Colors.Charts.Apdex.Good.Default}`, color: Colors.Charts.Apdex.Good.Default, textDecoration: "none" }}>
            {label} ↗
          </a>
        ))}
        {links.map(({ label, url }) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", fontSize: 12, fontWeight: 500, borderRadius: 6, border: `1px solid ${Colors.Charts.Apdex.Fair.Default}`, color: Colors.Charts.Apdex.Fair.Default, textDecoration: "none" }}>
            {label} ↗
          </a>
        ))}
      </Flex>
    </>,
  );
}

/* ── Page ────────────────────────────────────────────── */
export const Quality = () => {
  const { capability } = useCapability();
  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <Heading level={2}>Pillar 2: Quality</Heading>
      <Paragraph style={{ opacity: 0.6 }}>
        Defect Escape Rate (rolling 90 days) — what percentage of bugs are found in production? Target: &lt; 5%. Tracking for {capability.label}.
      </Paragraph>
      <DerSummary />
      <Scorecards />
      <DerTrend />
      <ProdBugsByComponent />
      <RecentProdBugs />
    </Flex>
  );
};
