import React from "react";
import { Link } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { useCapability } from "../CapabilityContext";
import {
  baselineSummaryQuery,
  derRollingQuarterQuery,
  viThroughputTrendQuery,
  derCustomerSplitRollingQuery,
  derTrendQuery,
  predictabilityTrendQuery,
  storyCycleTimeTrendQuery,
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
// Index matches pillar order on the Overview: 0=AI-First, 1=Unlock Value,
// 2=Quality, 3=Predictability, 4=Developer Experience.
export const PILLAR_COLORS = [
  Colors.Charts.Categorical.Color15.Default, // AI-First       — purple
  Colors.Charts.Categorical.Color11.Default, // Unlock Value   — bright blue
  Colors.Charts.Categorical.Color09.Default, // Quality        — green
  Colors.Charts.Categorical.Color14.Default, // Predictability — orange
  Colors.Charts.Categorical.Color07.Default, // Developer Exp. — teal
];

/** Compute quarter-over-quarter trend from monthly records.
 *  Returns "up" | "down" | "flat" based on sum/avg of last 3 months vs previous 3. */
function qoqTrend(
  records: { month?: unknown; [k: string]: unknown }[],
  field: string,
  mode: "sum" | "avg" = "sum",
): "up" | "down" | "flat" {
  if (records.length < 4) return "flat";
  const sorted = [...records].sort((a, b) => String(a.month ?? "").localeCompare(String(b.month ?? "")));
  const recent = sorted.slice(-3);
  const prev = sorted.slice(-6, -3);
  if (prev.length === 0) return "flat";
  const agg = (arr: typeof records) => {
    const vals = arr.map((r) => Number(r[field]) || 0);
    const total = vals.reduce((s, v) => s + v, 0);
    return mode === "avg" ? total / (vals.length || 1) : total;
  };
  const cur = agg(recent);
  const pre = agg(prev);
  const delta = pre !== 0 ? (cur - pre) / Math.abs(pre) : 0;
  if (Math.abs(delta) < 0.05) return "flat";
  return delta > 0 ? "up" : "down";
}

const TREND_SYMBOLS: Record<string, string> = { up: "▲", down: "▼", flat: "►" };

function PillarCard({ n, title, desc, metric, route, color, trend, trendGood }: {
  n: string; title: string; desc: string; metric: string; route: string; color: string;
  trend?: "up" | "down" | "flat"; trendGood?: "up" | "down";
}) {
  const isGood = trend === trendGood;
  const trendColor = !trend || trend === "flat"
    ? Colors.Charts.Apdex.Fair.Default
    : isGood
      ? Colors.Charts.Apdex.Good.Default
      : Colors.Charts.Apdex.Poor.Default;
  const label = !trend || trend === "flat" ? "Stable" : isGood ? "Improving" : "Declining";
  const symbol = trend ? TREND_SYMBOLS[trend] : undefined;
  return (
    <Link to={route} style={{ textDecoration: "none", flex: "1 1 220px", minWidth: 220 }}>
      <Surface style={{ height: "100%", cursor: "pointer", borderTop: `3px solid ${color}` }}>
        <Flex flexDirection="column" gap={8} padding={20} style={{ height: "100%" }}>
          <Flex gap={8} alignItems="center">
            <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{n}</span>
            <Heading level={5} style={{ lineHeight: 1.2 }}>{title}</Heading>
            {symbol && (
              <span
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  lineHeight: 1.2,
                  fontWeight: 600,
                  color: trendColor,
                }}
                title={`Quarter-over-quarter: ${label}`}
              >
                <span style={{ fontSize: 10, lineHeight: 1 }}>{symbol}</span>
                <span>{label}</span>
              </span>
            )}
          </Flex>
          <Paragraph style={{ opacity: 0.6, fontSize: 12, flex: 1 }}>{desc}</Paragraph>
          <Paragraph style={{ fontSize: 11, fontWeight: 600, color, lineHeight: 1.4, wordBreak: "break-word" }}>{metric}</Paragraph>
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
  const derTrend = useDql({ query: derTrendQuery(capability) });
  const predTrend = useDql({ query: predictabilityTrendQuery(capability) });
  const devexTrend = useDql({ query: storyCycleTimeTrendQuery(capability) });

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

  // QoQ trend arrows for pillar cards
  const valueTrend = qoqTrend(tpRecs as any[], "vi_count", "sum");        // more VIs = better → up is good
  const qualityTrend = qoqTrend((derTrend.data?.records ?? []) as any[], "der_pct", "avg"); // lower DER = better → down is good
  const predDirection = qoqTrend((predTrend.data?.records ?? []) as any[], "churn_pct", "avg"); // lower churn = better → down is good
  const devexDirection = qoqTrend((devexTrend.data?.records ?? []) as any[], "p50_cycle", "avg"); // lower cycle = better → down is good

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
      <Surface
        style={{
          width: "100%",
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(circle at 0% 0%, rgba(144,51,163,0.22) 0%, transparent 45%)," +
            "radial-gradient(circle at 100% 100%, rgba(98,124,254,0.18) 0%, transparent 50%)," +
            "linear-gradient(135deg, rgba(20,24,40,0.55) 0%, rgba(20,24,40,0.25) 100%)",
          borderTop: `2px solid ${PILLAR_COLORS[0]}`,
        }}
      >
        {/* Pillar colour stripe across the bottom of the hero, ties to the cards & nav dots */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            display: "flex",
          }}
        >
          {PILLAR_COLORS.map((c, i) => (
            <div key={i} style={{ flex: 1, background: c }} />
          ))}
        </div>
        <Flex flexDirection="column" gap={16} padding={32}>
          <Flex gap={8} alignItems="center" flexFlow="wrap">
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                opacity: 0.55,
              }}
            >
              AI-First Observer
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                opacity: 0.4,
                paddingLeft: 4,
              }}
            >
              {capability.label}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 10,
                background: `${PILLAR_COLORS[0]}33`,
                color: PILLAR_COLORS[0],
                border: `1px solid ${PILLAR_COLORS[0]}66`,
              }}
            >
              v0.9 · live
            </span>
          </Flex>
          <Heading level={1} style={{ fontSize: 34, letterSpacing: -0.6, lineHeight: 1.15 }}>
            How AI-First is changing engineering.
          </Heading>
          <Paragraph style={{ opacity: 0.7, fontSize: 15, lineHeight: 1.6, maxWidth: 880 }}>
            Five pillars: adoption, what we ship, the quality of what we ship, how reliably we ship it,
            and what it's like to work here. Measured against the same Grail data the teams use day-to-day.
            Every value increment, every bug, every PR.
            {totalClosed > 0 ? (<> <Strong>{totalClosed} VIs</Strong> closed in the last 12 months.</>) : null}
          </Paragraph>
          <Flex gap={8} flexFlow="wrap" style={{ marginTop: 4 }}>
            {[
              { label: "AI-First Adoption", c: PILLAR_COLORS[0] },
              { label: "Unlock Value", c: PILLAR_COLORS[1] },
              { label: "Quality", c: PILLAR_COLORS[2] },
              { label: "Predictability", c: PILLAR_COLORS[3] },
              { label: "Developer Experience", c: PILLAR_COLORS[4] },
            ].map((p) => (
              <span
                key={p.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 12,
                  background: `${p.c}1f`,
                  border: `1px solid ${p.c}55`,
                  color: p.c,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: p.c,
                    display: "inline-block",
                  }}
                />
                {p.label}
              </span>
            ))}
          </Flex>
          <Paragraph style={{ opacity: 0.45, fontSize: 12, marginTop: 4 }}>
            Every card shows the DQL behind it and opens straight into a Notebook.
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
            sub="created → resolved"
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
          n="1" title="AI-First Adoption" route="/ai-first" color={PILLAR_COLORS[0]}
          desc="Context-engineering coverage and AI-PR review-iteration health across the capability's repos. The lever everything else hangs off."
          metric="Maturity · failure modes · champions →"
        />
        <PillarCard
          n="2" title="Unlock Value" route="/value" color={PILLAR_COLORS[1]}
          desc="Deliver more valuable features, faster. Compress the 4-year roadmap into 1 year."
          metric={`${totalClosed} VIs closed · ${p50}d median cycle`}
          trend={valueTrend} trendGood="up"
        />
        <PillarCard
          n="3" title="Quality" route="/quality" color={PILLAR_COLORS[2]}
          desc="Drive Defect Escape Rate below 5%. Catch bugs before they reach customers."
          metric={`${derPct.toFixed(1)}% DER · ${custBugs} customer-escalated`}
          trend={qualityTrend} trendGood="down"
        />
        <PillarCard
          n="4" title="Predictability" route="/predictability" color={PILLAR_COLORS[3]}
          desc="Stable fix versions and target dates. Deliver what we commit to, when we commit to it."
          metric="Fix version stability →"
          trend={predDirection} trendGood="down"
        />
        <PillarCard
          n="5" title="Developer Experience" route="/devex" color={PILLAR_COLORS[4]}
          desc="Identify bottlenecks, reduce friction, and empower engineers to solve their own problems."
          metric="Sprint velocity & cycle time →"
          trend={devexDirection} trendGood="down"
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
