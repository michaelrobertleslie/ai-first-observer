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
  storyVelocityQuery,
  storyCycleTimeTrendQuery,
  wipQuery,
} from "../queries";

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
  const { data, isLoading } = useDql({ query: storyVelocityQuery(capability) });

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
      <Heading level={4}>Sprint Velocity (last 90 days)</Heading>
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
  const { data, isLoading } = useDql({ query: storyCycleTimeTrendQuery(capability) });

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
      <Heading level={4}>Story Cycle Time Trend (monthly)</Heading>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Average days from creation to close — is AI tooling reducing friction?</Paragraph>
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

/* ── Work in progress ───────────────────────────────── */
function WorkInProgress() {
  const { capability } = useCapability();
  const { data, isLoading } = useDql({ query: wipQuery(capability) });

  const columns: Col[] = useMemo(
    () => [
      { id: "Team", accessor: "Team", header: "Team", minWidth: 200 },
      { id: "status", accessor: "status", header: "Status", minWidth: 140 },
      { id: "wip_count", accessor: "wip_count", header: "WIP Count", minWidth: 100, alignment: "right" as const },
    ],
    [],
  );

  return card(
    <>
      <Heading level={4}>Work in Progress</Heading>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>Active stories by team and status — high WIP can indicate bottlenecks.</Paragraph>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data?.records ?? []} columns={columns} sortable resizable>
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      ) : empty("No active stories")}
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
        Proxy metrics from Jira for {capability.label}. Sprint velocity, story cycle time, and WIP indicate team flow and friction.
      </Paragraph>

      <Surface style={{ width: "100%" }}>
        <Flex flexDirection="column" gap={8} padding={24}>
          <Heading level={4}>Future: Direct DevEx Measurement</Heading>
          <Paragraph style={{ opacity: 0.6 }}>
            Industry frameworks like SPACE and DX Core 4 recommend combining developer surveys with system metrics.
            Future iterations will integrate survey data (satisfaction, perceived productivity, tooling effectiveness)
            alongside proxy metrics like PR cycle time, build times, and CI failure rates.
          </Paragraph>
        </Flex>
      </Surface>

      <SprintVelocity />
      <StoryCycleTime />
      <WorkInProgress />
    </Flex>
  );
};
