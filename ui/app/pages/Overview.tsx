import React from "react";
import { Link } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { useCapability } from "../CapabilityContext";
import {
  baselineSummaryQuery,
  derRollingQuarterQuery,
  viThroughputTrendQuery,
  derCustomerSplitRollingQuery,
} from "../queries";

/* ── Gauge ring (SVG progress ring) ─────────────────── */
function GaugeRing({ pct, color, size = 100 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circ * (1 - clamped / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} opacity={0.1} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${circ}`} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease-out" }} />
    </svg>
  );
}

/* ── Hero KPI card with gauge ────────────────────────── */
function HeroKpi({ label, value, target, pct, color, sub }: {
  label: string; value: string; target: string; pct: number; color: string; sub?: string;
}) {
  return (
    <Surface style={{ flex: "1 1 240px", minWidth: 240 }}>
      <Flex flexDirection="column" gap={4} padding={24} alignItems="center">
        <Paragraph style={{ opacity: 0.5, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</Paragraph>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 100, height: 100 }}>
          <GaugeRing pct={pct} color={color} />
          <Heading level={2} style={{ position: "absolute", color, fontSize: 26 }}>{value}</Heading>
        </div>
        <Paragraph style={{ opacity: 0.4, fontSize: 11 }}>Target: {target}</Paragraph>
        {sub && <Paragraph style={{ opacity: 0.35, fontSize: 10 }}>{sub}</Paragraph>}
      </Flex>
    </Surface>
  );
}

/* ── Pillar navigation card ──────────────────────────── */
const PILLAR_COLORS = [
  Colors.Charts.Apdex.Excellent.Default,
  Colors.Charts.Apdex.Good.Default,
  Colors.Charts.Apdex.Fair.Default,
  Colors.Charts.Apdex.Poor.Default,
];

function PillarCard({ n, title, desc, metric, route, color }: {
  n: string; title: string; desc: string; metric: string; route: string; color: string;
}) {
  return (
    <Link to={route} style={{ textDecoration: "none", flex: "1 1 220px", minWidth: 220 }}>
      <Surface style={{ height: "100%", cursor: "pointer", borderTop: `3px solid ${color}` }}>
        <Flex flexDirection="column" gap={8} padding={20} style={{ height: "100%" }}>
          <Flex gap={8} alignItems="center">
            <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{n}</span>
            <Heading level={5}>{title}</Heading>
          </Flex>
          <Paragraph style={{ opacity: 0.6, fontSize: 12, flex: 1 }}>{desc}</Paragraph>
          <Paragraph style={{ fontSize: 11, fontWeight: 600, color }}>{metric}</Paragraph>
        </Flex>
      </Surface>
    </Link>
  );
}

export const Overview = () => {
  const { capability } = useCapability();
  const baseline = useDql({ query: baselineSummaryQuery(capability) });
  const der = useDql({ query: derRollingQuarterQuery(capability) });
  const throughput = useDql({ query: viThroughputTrendQuery(capability) });
  const custSplit = useDql({ query: derCustomerSplitRollingQuery(capability) });

  const bl = baseline.data?.records?.[0];
  const derRecords = der.data?.records ?? [];
  const totalBugs = derRecords.reduce((s, r) => s + (Number(r.bug_count) || 0), 0);
  const prodBugs = Number(derRecords.find((r) => r["Found in"] === "PRODUCTION")?.bug_count) || 0;
  const derPct = totalBugs > 0 ? (100 * prodBugs / totalBugs) : 0;

  // Customer-facing DER split
  const custRecs = custSplit.data?.records ?? [];
  const custBugs = Number(custRecs.find((r) => r.source === "Customer-Escalated")?.bug_count) || 0;
  const custDerPct = totalBugs > 0 ? (100 * custBugs / totalBugs) : 0;

  // Throughput trend — latest quarter VI count
  const tpRecs = throughput.data?.records ?? [];
  const latestQVis = tpRecs.slice(-3).reduce((s, r) => s + (Number(r.vi_count) || 0), 0);

  const anyLoading = baseline.isLoading || der.isLoading || throughput.isLoading || custSplit.isLoading;

  // Gauge percentages (inverted for "lower is better" metrics)
  const p50 = bl ? Math.round(Number(bl.p50_cycle_days)) : 0;
  const p90 = bl ? Math.round(Number(bl.p90_cycle_days)) : 0;
  const totalClosed = bl ? Number(bl.total_closed) : 0;

  // Color helpers
  const derColor = derPct > 20 ? Colors.Charts.Apdex.Unacceptable.Default : derPct > 10 ? Colors.Charts.Apdex.Poor.Default : derPct > 5 ? Colors.Charts.Apdex.Fair.Default : Colors.Charts.Apdex.Good.Default;
  const cycleColor = p50 > 180 ? Colors.Charts.Apdex.Unacceptable.Default : p50 > 120 ? Colors.Charts.Apdex.Poor.Default : p50 > 90 ? Colors.Charts.Apdex.Fair.Default : Colors.Charts.Apdex.Good.Default;
  const custColor = custDerPct > 10 ? Colors.Charts.Apdex.Unacceptable.Default : custDerPct > 5 ? Colors.Charts.Apdex.Poor.Default : Colors.Charts.Apdex.Good.Default;

  return (
    <Flex flexDirection="column" gap={20} padding={16}>
      {/* ── Hero banner ─────────────────────────────── */}
      <Surface style={{ width: "100%", background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(20,184,166,0.06) 100%)" }}>
        <Flex flexDirection="column" gap={4} padding={32}>
          <Heading level={1}>AI-First Observer</Heading>
          <Paragraph style={{ opacity: 0.5, fontSize: 14, maxWidth: 700 }}>
            Measuring the impact of AI-First on software delivery for <strong>{capability.label}</strong>.
            Baseline today, benchmark tomorrow.
          </Paragraph>
        </Flex>
      </Surface>

      {/* ── KPI gauges ──────────────────────────────── */}
      {anyLoading ? (
        <Flex justifyContent="center" padding={48}><ProgressCircle /></Flex>
      ) : (
        <Flex gap={16} flexFlow="wrap" style={{ width: "100%" }}>
          <HeroKpi
            label="VIs Closed (12 mo)"
            value={String(totalClosed)}
            target="Increase YoY"
            pct={Math.min(100, (totalClosed / 120) * 100)}
            color={Colors.Charts.Apdex.Excellent.Default}
            sub={`${latestQVis} in latest quarter`}
          />
          <HeroKpi
            label="Median Cycle Time"
            value={`${p50}d`}
            target="< 90 days"
            pct={Math.max(0, 100 - (p50 / 3.6))}
            color={cycleColor}
          />
          <HeroKpi
            label="DER (Rolling Quarter)"
            value={`${derPct.toFixed(1)}%`}
            target="< 5%"
            pct={Math.max(0, 100 - derPct * 2)}
            color={derColor}
            sub={`${prodBugs.toLocaleString()} prod / ${totalBugs.toLocaleString()} total (90d)`}
          />
          <HeroKpi
            label="Customer DER (Rolling Qtr)"
            value={`${custDerPct.toFixed(1)}%`}
            target="< 2%"
            pct={Math.max(0, 100 - custDerPct * 5)}
            color={custColor}
            sub={`${custBugs} customer-escalated prod bugs (90d)`}
          />
        </Flex>
      )}

      {/* ── Pillar navigation cards ─────────────────── */}
      <Flex gap={16} flexFlow="wrap" style={{ width: "100%" }}>
        <PillarCard
          n="1" title="Unlock Value" route="/value" color={PILLAR_COLORS[0]}
          desc="Deliver more valuable features, faster. Compress the 4-year roadmap into 1 year."
          metric={`${totalClosed} VIs closed · ${p50}d median cycle`}
        />
        <PillarCard
          n="2" title="Quality" route="/quality" color={PILLAR_COLORS[1]}
          desc="Drive Defect Escape Rate below 5%. Catch bugs before they reach customers."
          metric={`${derPct.toFixed(1)}% DER · ${custBugs} customer-escalated`}
        />
        <PillarCard
          n="3" title="Predictability" route="/predictability" color={PILLAR_COLORS[2]}
          desc="Stable fix versions and target dates. Deliver what we commit to, when we commit to it."
          metric="Fix version stability →"
        />
        <PillarCard
          n="4" title="Developer Experience" route="/devex" color={PILLAR_COLORS[3]}
          desc="Eliminate SDLC bottlenecks. Engineers should love working with AI-first tooling."
          metric="Sprint velocity & cycle time →"
        />
      </Flex>

      {/* ── Juno integration note ───────────────────── */}
      <Surface style={{ width: "100%", borderLeft: `3px solid ${Colors.Charts.Apdex.Fair.Default}` }}>
        <Flex flexDirection="column" gap={8} padding={20}>
          <Heading level={5}>Juno Software Catalog</Heading>
          <Paragraph style={{ opacity: 0.6, fontSize: 12 }}>
            Component quality scorecards from Dynatrace's internal developer portal (Backstage).
            Future versions will integrate Juno TechDocs and catalog scores directly.
          </Paragraph>
          <Paragraph style={{ fontSize: 12 }}>
            <a href={capability.junoCatalogUrl} target="_blank" rel="noopener noreferrer" style={{ color: Colors.Charts.Apdex.Excellent.Default }}>
              {capability.label} in Juno ↗
            </a>
            {" · "}
            <a href="https://juno.internal.dynatrace.com/assistant" target="_blank" rel="noopener noreferrer" style={{ color: Colors.Charts.Apdex.Excellent.Default }}>
              Juno Assistant ↗
            </a>
          </Paragraph>
        </Flex>
      </Surface>
    </Flex>
  );
};
