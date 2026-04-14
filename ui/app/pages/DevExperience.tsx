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
  storyVelocityQuery,
  storyCycleTimeTrendQuery,
  wipQuery,
  wipDetailQuery,
} from "../queries";
import { QueryInspector } from "../components/QueryInspector";

type Col = DataTableColumnDef<ResultRecord>;

function card(children: React.ReactNode) {
  return (
    <Surface style={{ width: "100%" }}>
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

/* ── Sprint velocity (chart + table) ────────────────── */
function SprintVelocity() {
  const { capability } = useCapability();
  const query = storyVelocityQuery(capability);
  const { data, isLoading } = useDql({ query });

  const chartData = useMemo(
    () => (data?.records ?? []).slice().reverse().map((r) => ({
      category: String(r.Sprint ?? "").replace(/^.*?\s/, ""),
      value: Number(r.stories_closed) || 0,
    })),
    [data],
  );

  const pointsData = useMemo(
    () => (data?.records ?? []).slice().reverse().map((r) => ({
      category: String(r.Sprint ?? "").replace(/^.*?\s/, ""),
      value: Math.round(Number(r.total_points) || 0),
    })),
    [data],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Sprint Velocity (last 90 days)</Heading>
        <QueryInspector query={query} title="Sprint Velocity — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Stories closed and story points per sprint — proxy for team throughput.</Paragraph>
      {isLoading ? loading() : chartData.length > 0 ? (
        <Flex flexDirection="column" gap={16}>
          <Flex flexDirection="column" gap={4}>
            <Paragraph style={{ fontSize: 11, fontWeight: 600 }}>Stories Closed</Paragraph>
            <CategoricalBarChart data={chartData} layout="vertical">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Paragraph style={{ fontSize: 11, fontWeight: 600 }}>Story Points</Paragraph>
            <CategoricalBarChart data={pointsData} layout="vertical">
              <CategoricalBarChart.Legend hidden />
            </CategoricalBarChart>
          </Flex>
        </Flex>
      ) : empty("No sprint data")}
    </>,
  );
}

/* ── Story cycle time trend (chart) ─────────────────── */
function StoryCycleTime() {
  const { capability } = useCapability();
  const query = storyCycleTimeTrendQuery(capability);
  const { data, isLoading } = useDql({ query });

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
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Story Cycle Time Trend (6 months)</Heading>
        <QueryInspector query={query} title="Story Cycle Time — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Average and median days from creation to close — is AI tooling reducing friction?</Paragraph>
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

/* ── Work in progress (expandable) ──────────────────── */
function WorkInProgress() {
  const { capability } = useCapability();
  const query = wipQuery(capability);
  const { data, isLoading } = useDql({ query });
  const { data: detailData, isLoading: detailLoading } = useDql({ query: wipDetailQuery(capability) });
  const [showDetail, setShowDetail] = useState(false);

  const columns: Col[] = useMemo(
    () => [
      { id: "Team", accessor: "Team", header: "Team", minWidth: 200 },
      { id: "status", accessor: "status", header: "Status", minWidth: 140 },
      { id: "wip_count", accessor: "wip_count", header: "WIP Count", minWidth: 100, alignment: "right" as const },
    ],
    [],
  );

  const detailColumns: Col[] = useMemo(
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
      { id: "status", accessor: "status", header: "Status", minWidth: 120 },
      { id: "Team", accessor: "Team", header: "Team", minWidth: 180 },
      { id: "assignee", accessor: "assignee", header: "Assignee", minWidth: 150 },
      {
        id: "created", accessor: "created", header: "Created", minWidth: 110,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {value ? String(value).substring(0, 10) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  const detailRecords = detailData?.records ?? [];

  return card(
    <>
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Flex gap={8} alignItems="center">
            <Heading level={4}>Work in Progress</Heading>
            <QueryInspector query={query} title="Work in Progress — DQL" />
          </Flex>
          <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Active stories by team and status — high WIP can indicate bottlenecks.</Paragraph>
        </Flex>
        <button
          onClick={() => setShowDetail(!showDetail)}
          style={{
            padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
            borderRadius: 6, border: `1px solid ${Colors.Charts.Apdex.Good.Default}`,
            color: Colors.Charts.Apdex.Good.Default, background: "transparent",
          }}
        >
          {showDetail ? "Hide Stories" : `Show Stories (${detailRecords.length})`}
        </button>
      </Flex>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      ) : empty("No active stories")}
      {showDetail && (
        <Flex flexDirection="column" gap={8} style={{ marginTop: 8 }}>
          <Heading level={5} style={{ color: Colors.Charts.Apdex.Good.Default }}>Individual Stories</Heading>
          {detailLoading ? loading() : detailRecords.length > 0 ? (
            <DataTable data={detailRecords} columns={detailColumns} sortable resizable>
              <DataTable.Pagination defaultPageSize={15} />
            </DataTable>
          ) : empty("No active stories")}
        </Flex>
      )}
    </>,
  );
}

/* ── Page ────────────────────────────────────────────── */
export const DevExperience = () => {
  const { capability } = useCapability();
  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <Heading level={2}>Pillar 4: Developer Experience</Heading>
      <Paragraph style={{ opacity: 0.6 }}>
        Identify bottlenecks, reduce friction, and empower engineers to solve their own problems. The metrics below expose where
        work stalls so {capability.label} teams can self-diagnose and act — without waiting for a report.
      </Paragraph>

      <Surface style={{ width: "100%" }}>
        <Flex flexDirection="column" gap={8} padding={24}>
          <Heading level={4}>Evolving: Richer DevEx Metrics</Heading>
          <Paragraph style={{ opacity: 0.6, fontSize: 13 }}>
            Sprint velocity, cycle time, and WIP are proxy metrics from Jira. As the AI-First Observer evolves, we plan to incorporate:
          </Paragraph>
          <Flex flexDirection="column" gap={4} style={{ paddingLeft: 16 }}>
            <Paragraph style={{ fontSize: 12 }}>
              <strong style={{ color: Colors.Charts.Apdex.Excellent.Default }}>Next up:</strong>{" "}
              GitHub PR cycle time, review turnaround, and merge velocity (requires GitHub event ingestion into Grail)
            </Paragraph>
            <Paragraph style={{ fontSize: 12 }}>
              <strong style={{ color: Colors.Charts.Apdex.Good.Default }}>Planned:</strong>{" "}
              CI/CD pipeline duration and failure rates · Build feedback loop times
            </Paragraph>
            <Paragraph style={{ fontSize: 12 }}>
              <strong style={{ color: Colors.Charts.Apdex.Fair.Default }}>Future:</strong>{" "}
              Developer surveys (SPACE / DX Core 4) for satisfaction, perceived productivity, and tooling effectiveness
            </Paragraph>
          </Flex>
          <Paragraph style={{ opacity: 0.4, fontSize: 11, marginTop: 4 }}>
            The goal: engineers can see exactly where friction exists and fix it themselves, without waiting for management to notice.
          </Paragraph>
        </Flex>
      </Surface>

      <SprintVelocity />
      <StoryCycleTime />
      <WorkInProgress />
    </Flex>
  );
};
