import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { useCapability } from "../CapabilityContext";
import { baselineSummaryQuery, derSummaryQuery } from "../queries";

function card(children: React.ReactNode, style?: React.CSSProperties) {
  return (
    <Surface style={{ ...style }}>
      <Flex flexDirection="column" gap={8} padding={24} alignItems="center">{children}</Flex>
    </Surface>
  );
}

export const Overview = () => {
  const { capability } = useCapability();
  const baseline = useDql({ query: baselineSummaryQuery(capability) });
  const der = useDql({ query: derSummaryQuery(capability) });

  const bl = baseline.data?.records?.[0];
  const derRecords = der.data?.records ?? [];
  const totalBugs = derRecords.reduce((s, r) => s + (Number(r.bug_count) || 0), 0);
  const prodBugs = Number(derRecords.find((r) => r["Found in"] === "PRODUCTION")?.bug_count) || 0;
  const derPct = totalBugs > 0 ? (100 * prodBugs / totalBugs) : 0;

  const anyLoading = baseline.isLoading || der.isLoading;

  const metrics = [
    {
      label: "VIs Closed (12 mo)",
      value: bl ? String(bl.total_closed) : "—",
      sub: "Pillar 1: Unlock Value",
      color: undefined,
    },
    {
      label: "Median Cycle Time",
      value: bl ? `${Math.round(Number(bl.p50_cycle_days))}d` : "—",
      sub: "Pillar 1: Target < 90 days",
      color: bl && Number(bl.p50_cycle_days) > 180 ? Colors.Charts.Apdex.Unacceptable.Default : undefined,
    },
    {
      label: "Defect Escape Rate",
      value: `${derPct.toFixed(1)}%`,
      sub: "Pillar 2: Target < 5%",
      color: derPct > 20 ? Colors.Charts.Apdex.Unacceptable.Default : derPct > 5 ? Colors.Charts.Apdex.Poor.Default : Colors.Charts.Apdex.Good.Default,
    },
    {
      label: "p90 Cycle Time",
      value: bl ? `${Math.round(Number(bl.p90_cycle_days))}d` : "—",
      sub: "Pillar 1: Long-tail indicator",
      color: bl && Number(bl.p90_cycle_days) > 365 ? Colors.Charts.Apdex.Poor.Default : undefined,
    },
  ];

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      <Heading level={2}>AI-First Observer</Heading>
      <Paragraph style={{ opacity: 0.6 }}>
        Measuring the impact of AI-First on delivery for {capability.label}.
        These are baseline metrics — track them over time to see if AI-First is moving the needle.
      </Paragraph>

      {anyLoading ? (
        <Flex justifyContent="center" padding={48}><ProgressCircle /></Flex>
      ) : (
        <Flex gap={16} flexFlow="wrap" style={{ width: "100%" }}>
          {metrics.map(({ label, value, sub, color }) => (
            <Surface key={label} style={{ flex: "1 1 200px", minWidth: 200 }}>
              <Flex flexDirection="column" gap={8} padding={24} alignItems="center">
                <Paragraph style={{ opacity: 0.6, fontSize: 12 }}>{label}</Paragraph>
                <Heading level={2} style={{ color }}>{value}</Heading>
                <Paragraph style={{ opacity: 0.4, fontSize: 11 }}>{sub}</Paragraph>
              </Flex>
            </Surface>
          ))}
        </Flex>
      )}

      <Surface style={{ width: "100%" }}>
        <Flex flexDirection="column" gap={12} padding={24}>
          <Heading level={4}>The Four Pillars</Heading>
          <Flex flexDirection="column" gap={8}>
            {[
              { n: "1", title: "Unlock Value", desc: "Deliver more valuable features, faster. Compress the 4-year roadmap into 1 year." },
              { n: "2", title: "Quality", desc: "Drive Defect Escape Rate below 5%. Catch bugs before production." },
              { n: "3", title: "Predictability", desc: "Stable fix versions and target dates. Deliver what we commit to, when we commit to it." },
              { n: "4", title: "Developer Experience", desc: "Eliminate SDLC bottlenecks. Engineers should love working with AI-first tooling." },
            ].map(({ n, title, desc }) => (
              <Flex key={n} gap={12} alignItems="baseline">
                <Heading level={5} style={{ flex: "0 0 24px", opacity: 0.5 }}>{n}</Heading>
                <Flex flexDirection="column">
                  <Heading level={5}>{title}</Heading>
                  <Paragraph style={{ opacity: 0.6 }}>{desc}</Paragraph>
                </Flex>
              </Flex>
            ))}
          </Flex>
        </Flex>
      </Surface>
    </Flex>
  );
};
