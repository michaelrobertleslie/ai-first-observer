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
  derSummaryQuery,
  derTrendQuery,
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

/* ── DER overview ───────────────────────────────────── */
function DerSummary() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: derSummaryQuery(capability) });

  const records = data?.records ?? [];
  const total = records.reduce((s, r) => s + (Number(r.bug_count) || 0), 0);
  const prod = Number(records.find((r) => r["Found in"] === "PRODUCTION")?.bug_count) || 0;
  const derPct = total > 0 ? (100 * prod / total) : 0;

  const chartData = useMemo(
    () => records.map((r) => ({
      category: String(r["Found in"] ?? "Unknown"),
      value: Number(r.bug_count) || 0,
    })),
    [records],
  );

  return (
    <Flex gap={16} style={{ width: "100%" }} flexFlow="wrap">
      {/* DER card */}
      <Surface style={{ flex: "0 0 220px" }}>
        <Flex flexDirection="column" gap={8} padding={24} alignItems="center">
          <Paragraph style={{ opacity: 0.6, fontSize: 12 }}>Defect Escape Rate</Paragraph>
          {isLoading ? <ProgressCircle /> : (
            <>
              <Heading level={1} style={{ color: derPct > 20 ? Colors.Charts.Apdex.Unacceptable.Default : derPct > 5 ? Colors.Charts.Apdex.Poor.Default : Colors.Charts.Apdex.Good.Default }}>
                {derPct.toFixed(1)}%
              </Heading>
              <Paragraph style={{ opacity: 0.5, fontSize: 11 }}>
                {prod.toLocaleString()} prod / {total.toLocaleString()} total (12 mo)
              </Paragraph>
              <Paragraph style={{ opacity: 0.4, fontSize: 11 }}>Target: &lt; 5%</Paragraph>
            </>
          )}
        </Flex>
      </Surface>

      {/* Waterfall chart */}
      <Surface style={{ flex: "1 1 400px", minWidth: 340 }}>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Heading level={4}>Bugs by Discovery Stage (12 months)</Heading>
          {isLoading ? loading() : chartData.length > 0 ? (
            <CategoricalBarChart data={chartData} layout="horizontal">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          ) : empty("No bug data")}
        </Flex>
      </Surface>
    </Flex>
  );
}

/* ── DER trend ──────────────────────────────────────── */
function DerTrend() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: derTrendQuery(capability) });

  const columns: Col[] = useMemo(
    () => [
      { id: "month", accessor: "month", header: "Month", minWidth: 100 },
      { id: "total", accessor: "total", header: "Total Bugs", minWidth: 100, alignment: "right" as const },
      { id: "prod_count", accessor: "prod_count", header: "Prod Bugs", minWidth: 100, alignment: "right" as const },
      {
        id: "der_pct", accessor: "der_pct", header: "DER %", minWidth: 100, alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const pct = Number(value) || 0;
          const color = pct > 20 ? Colors.Charts.Apdex.Unacceptable.Default : pct > 5 ? Colors.Charts.Apdex.Poor.Default : Colors.Charts.Apdex.Good.Default;
          return (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", color, fontWeight: pct > 20 ? 700 : 400 }}>
              {pct.toFixed(1)}%
            </span>
          );
        },
      },
    ],
    [],
  );

  return card(
    <>
      <Heading level={4}>DER Trend (monthly)</Heading>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data?.records ?? []} columns={columns} sortable resizable />
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
          <span style={{ display: "flex", alignItems: "center", height: "100%", fontWeight: 600 }}>{String(value ?? "")}</span>
        ),
      },
      { id: "summary", accessor: "summary", header: "Summary", minWidth: 300 },
      { id: "status", accessor: "status", header: "Status", minWidth: 120 },
      { id: "assignee", accessor: "assignee", header: "Assignee", minWidth: 150 },
      {
        id: "created", accessor: "created", header: "Created", minWidth: 120,
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

/* ── Page ────────────────────────────────────────────── */
export const Quality = () => {
  const { capability } = useCapability();
  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <Heading level={2}>Pillar 2: Quality</Heading>
      <Paragraph style={{ opacity: 0.6 }}>
        Defect Escape Rate — what percentage of bugs are found in production? Target: &lt; 5%. Tracking for {capability.label}.
      </Paragraph>
      <DerSummary />
      <DerTrend />
      <ProdBugsByComponent />
      <RecentProdBugs />
    </Flex>
  );
};
