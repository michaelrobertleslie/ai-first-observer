import React, { useMemo } from "react";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components-preview/tables";
import { CategoricalBarChart } from "@dynatrace/strato-components/charts";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import Colors from "@dynatrace/strato-design-tokens/colors";
import type { ResultRecord } from "@dynatrace-sdk/client-query";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { useCapability } from "../CapabilityContext";
import { aiFirstConfig } from "../config";
import {
  aiAdoptionSummaryQuery,
  aiMaturityFunnelQuery,
  aiRepoLatestScanQuery,
  aiFailureModesQuery,
  aiFailureDetailQuery,
  aiChampionsQuery,
  aiPrFirstAttemptTrendQuery,
  aiPrSplitQuery,
  aiCorrectionHeatmapQuery,
  aiRecentPrsQuery,
} from "../queries";
import { QueryInspector } from "../components/QueryInspector";

type Col = DataTableColumnDef<ResultRecord>;

const TIER_LABELS: Record<string, string> = {
  none: "None",
  main_only: "Main file only",
  two_tier: "Two-tier",
  two_tier_skills: "Two-tier + skills",
  full_stack: "Full stack",
};

const TIER_ORDER = ["none", "main_only", "two_tier", "two_tier_skills", "full_stack"];

const TIER_COLOURS: Record<string, string> = {
  none: Colors.Charts.Apdex.Unacceptable.Default,
  main_only: Colors.Charts.Apdex.Poor.Default,
  two_tier: Colors.Charts.Apdex.Fair.Default,
  two_tier_skills: Colors.Charts.Apdex.Good.Default,
  full_stack: Colors.Charts.Apdex.Excellent.Default,
};

function card(children: React.ReactNode) {
  return (
    <Surface style={{ width: "100%" }}>
      <Flex flexDirection="column" gap={12} padding={24}>
        {children}
      </Flex>
    </Surface>
  );
}

function loading() {
  return (
    <Flex justifyContent="center" padding={24}>
      <ProgressCircle />
    </Flex>
  );
}

function empty(msg: string) {
  return <Paragraph style={{ opacity: 0.5 }}>{msg}</Paragraph>;
}

function bool(value: unknown): string {
  return value === true ? "Yes" : "No";
}

function colourForScore(score: number): string {
  if (score >= 80) return Colors.Charts.Apdex.Excellent.Default;
  if (score >= 60) return Colors.Charts.Apdex.Good.Default;
  if (score >= 40) return Colors.Charts.Apdex.Fair.Default;
  if (score >= 20) return Colors.Charts.Apdex.Poor.Default;
  return Colors.Charts.Apdex.Unacceptable.Default;
}

/* ── Hero KPIs ───────────────────────────────────────── */
function AdoptionHero() {
  const { capability } = useCapability();
  const cfg = aiFirstConfig(capability);
  const query = aiAdoptionSummaryQuery(capability);
  const { data, isLoading } = useDql({ query });

  const r = data?.records?.[0];
  const total = Number(r?.total ?? 0);
  const withMain = Number(r?.with_main ?? 0);
  const twoTierPlus = Number(r?.two_tier_plus ?? 0);
  const fullStack = Number(r?.full_stack ?? 0);
  const avgScore = Math.round(Number(r?.avg_score ?? 0));
  const meetsTarget = avgScore >= cfg.scoreTarget;

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Adoption Snapshot</Heading>
        <QueryInspector query={query} title="Adoption Snapshot — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Repos scanned, context-engineering coverage, and average maturity score.
      </Paragraph>
      {isLoading ? (
        loading()
      ) : total === 0 ? (
        empty("No scan data yet. Run scripts/ai-first-scanner/scan.py --emit.")
      ) : (
        <Flex gap={32} flexWrap="wrap">
          <KpiBlock value={String(total)} label="Repos scanned" />
          <KpiBlock value={`${withMain} (${pct(withMain)}%)`} label="With main file" />
          <KpiBlock
            value={`${twoTierPlus} (${pct(twoTierPlus)}%)`}
            label="Two-tier or richer"
          />
          <KpiBlock
            value={`${fullStack} (${pct(fullStack)}%)`}
            label="Full stack"
          />
          <KpiBlock
            value={String(avgScore)}
            label={`Avg maturity score (target ${cfg.scoreTarget})`}
            color={meetsTarget ? Colors.Charts.Apdex.Good.Default : colourForScore(avgScore)}
          />
        </Flex>
      )}
    </>,
  );
}

function KpiBlock({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <Flex flexDirection="column" gap={4} style={{ minWidth: 140 }}>
      <Heading level={2} style={{ color: color ?? "inherit", fontSize: 28 }}>
        {value}
      </Heading>
      <Text style={{ opacity: 0.7, fontSize: 12 }}>{label}</Text>
    </Flex>
  );
}

/* ── Maturity funnel (bar chart) ─────────────────────── */
function MaturityFunnel() {
  const { capability } = useCapability();
  const query = aiMaturityFunnelQuery(capability);
  const { data, isLoading } = useDql({ query });

  const chartData = useMemo(() => {
    const byTier = new Map<string, number>();
    (data?.records ?? []).forEach((r) => {
      byTier.set(String(r.tier ?? "none"), Number(r.repo_count) || 0);
    });
    return TIER_ORDER.map((tier) => ({
      category: TIER_LABELS[tier] ?? tier,
      value: byTier.get(tier) ?? 0,
      color: TIER_COLOURS[tier],
    }));
  }, [data]);

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Maturity Funnel</Heading>
        <QueryInspector query={query} title="Maturity Funnel — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Article tiers from autocomplete (none) through to full-stack (main + rules + skills + MCP).
      </Paragraph>
      {isLoading ? (
        loading()
      ) : chartData.some((d) => d.value > 0) ? (
        <CategoricalBarChart data={chartData} layout="horizontal">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : (
        empty("No scan data yet")
      )}
    </>,
  );
}

/* ── Per-repo scorecard (table) ──────────────────────── */
function RepoScorecard() {
  const { capability } = useCapability();
  const query = aiRepoLatestScanQuery(capability);
  const { data, isLoading } = useDql({ query });

  const columns: Col[] = useMemo(
    () => [
      {
        id: "repo_slug",
        accessor: "repo_slug",
        header: "Repo",
        minWidth: 180,
        cell: ({ value, rowData }: { value: unknown; rowData: ResultRecord }) => {
          const url = String(rowData.repo_url ?? "");
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                fontWeight: 600,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {String(value ?? "")}
            </a>
          );
        },
      },
      {
        id: "tier",
        accessor: "tier",
        header: "Tier",
        minWidth: 140,
        cell: ({ value }: { value: unknown }) => (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              color: TIER_COLOURS[String(value ?? "none")] ?? "inherit",
              fontWeight: 600,
            }}
          >
            {TIER_LABELS[String(value ?? "none")] ?? String(value ?? "")}
          </span>
        ),
      },
      {
        id: "score",
        accessor: "score",
        header: "Score",
        minWidth: 80,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const n = Number(value ?? 0);
          return (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                fontWeight: 700,
                color: colourForScore(n),
              }}
            >
              {n}
            </span>
          );
        },
      },
      { id: "main_tokens", accessor: "main_tokens", header: "Main tokens", minWidth: 110, alignment: "right" as const },
      { id: "rules_count", accessor: "rules_count", header: "Rules", minWidth: 70, alignment: "right" as const },
      { id: "skills_count", accessor: "skills_count", header: "Skills", minWidth: 70, alignment: "right" as const },
      { id: "anti_patterns", accessor: "anti_patterns", header: "Anti-pat", minWidth: 80, alignment: "right" as const },
      {
        id: "self_healing",
        accessor: "self_healing",
        header: "Self-heal",
        minWidth: 90,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>{bool(value)}</span>
        ),
      },
      {
        id: "mcp_present",
        accessor: "mcp_present",
        header: "MCP",
        minWidth: 70,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>{bool(value)}</span>
        ),
      },
      { id: "main_age_days", accessor: "main_age_days", header: "Age (d)", minWidth: 80, alignment: "right" as const },
      { id: "champion_author", accessor: "champion_author", header: "Champion", minWidth: 200 },
    ],
    [],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Per-repo Scorecard</Heading>
        <QueryInspector query={query} title="Repo Scorecard — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Latest scan per repo. Click a repo name to open it in Bitbucket.
      </Paragraph>
      <Paragraph style={{ opacity: 0.45, fontSize: 11, lineHeight: 1.5 }}>
        <strong>Tier</strong>: maturity progression — none → main file only → two-tier (main + rules) → two-tier + skills → full stack (with MCP).
        <br />
        <strong>Score</strong>: 0–100 weighted by tier, anti-pattern density, self-healing, and MCP wiring.
        <br />
        <strong>Main tokens</strong>: estimated tokens in the primary instruction file (CLAUDE.md / AGENTS.md / copilot-instructions.md). Above ~2,500 tokens the file is flagged as <em>bloat</em> — it stops fitting reliably in the agent's context window.
        <br />
        <strong>Champion</strong>: most recent author of any context file in the last 90 days (commits to CLAUDE.md / AGENTS.md / .claude/rules / .claude/skills). Empty means nobody has touched the context recently.
      </Paragraph>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data!.records!} columns={columns} sortable />
      ) : (
        empty("No scan data yet")
      )}
    </>,
  );
}

/* ── Failure modes (counts + drill-down list) ────────── */
function FailureModes() {
  const { capability } = useCapability();
  const cfg = aiFirstConfig(capability);
  const summaryQuery = aiFailureModesQuery(capability);
  const detailQuery = aiFailureDetailQuery(capability);
  const { data: summary, isLoading: sumLoading } = useDql({ query: summaryQuery });
  const { data: detail, isLoading: detailLoading } = useDql({ query: detailQuery });

  const r = summary?.records?.[0];
  const total = Number(r?.total_repos ?? 0);

  const summaryItems = [
    { key: "bloat", label: `Bloat (>${cfg.mainTokenBudget.toLocaleString()} tokens)`, count: Number(r?.bloat ?? 0) },
    { key: "staleness", label: "Stale", count: Number(r?.staleness ?? 0) },
    { key: "missing_self_healing", label: "Missing self-heal", count: Number(r?.missing_self_healing ?? 0) },
    { key: "vagueness", label: "Vague (low anti-pattern density)", count: Number(r?.vagueness ?? 0) },
    { key: "copy_paste", label: "Copy-paste", count: Number(r?.copy_paste ?? 0) },
  ];

  const detailColumns: Col[] = useMemo(
    () => [
      {
        id: "repo_slug",
        accessor: "repo_slug",
        header: "Repo",
        minWidth: 180,
        cell: ({ value, rowData }: { value: unknown; rowData: ResultRecord }) => (
          <a
            href={String(rowData.repo_url ?? "")}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              fontWeight: 600,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            {String(value ?? "")}
          </a>
        ),
      },
      {
        id: "tier",
        accessor: "tier",
        header: "Tier",
        minWidth: 140,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {TIER_LABELS[String(value ?? "none")] ?? String(value ?? "")}
          </span>
        ),
      },
      { id: "score", accessor: "score", header: "Score", minWidth: 70, alignment: "right" as const },
      {
        id: "bloat",
        accessor: "bloat",
        header: "Bloat",
        minWidth: 70,
        alignment: "center" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{bool(value)}</span>
        ),
      },
      {
        id: "staleness",
        accessor: "staleness",
        header: "Stale",
        minWidth: 70,
        alignment: "center" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{bool(value)}</span>
        ),
      },
      {
        id: "missing_sh",
        accessor: "missing_sh",
        header: "No self-heal",
        minWidth: 100,
        alignment: "center" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{bool(value)}</span>
        ),
      },
      {
        id: "vagueness",
        accessor: "vagueness",
        header: "Vague",
        minWidth: 80,
        alignment: "center" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{bool(value)}</span>
        ),
      },
      {
        id: "copy_paste",
        accessor: "copy_paste",
        header: "Copy-paste",
        minWidth: 100,
        alignment: "center" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>{bool(value)}</span>
        ),
      },
      { id: "main_tokens", accessor: "main_tokens", header: "Tokens", minWidth: 80, alignment: "right" as const },
      { id: "main_age_days", accessor: "main_age_days", header: "Age (d)", minWidth: 80, alignment: "right" as const },
    ],
    [],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Failure Modes</Heading>
        <QueryInspector query={summaryQuery} title="Failure Modes — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        The five failure modes from the article, flagged across {total} repos. Each repo is checked against
        objective thresholds (no human grading) so the action list is reproducible. Rows in the table below are
        repos failing at least one check — sorted lowest-score first, so the worst offenders surface at the top.
        A clean table is the goal.
      </Paragraph>

      <FailureModeGuide budget={cfg.mainTokenBudget} />

      {sumLoading ? (
        loading()
      ) : (
        <Flex gap={24} flexWrap="wrap">
          {summaryItems.map((item) => (
            <Flex key={item.key} flexDirection="column" gap={2} style={{ minWidth: 180 }}>
              <Heading
                level={3}
                style={{
                  color: item.count > 0 ? Colors.Charts.Apdex.Poor.Default : Colors.Charts.Apdex.Good.Default,
                  fontSize: 22,
                }}
              >
                {item.count}
              </Heading>
              <Text style={{ opacity: 0.7, fontSize: 12 }}>{item.label}</Text>
            </Flex>
          ))}
        </Flex>
      )}
      {detailLoading ? (
        loading()
      ) : (detail?.records?.length ?? 0) > 0 ? (
        <DataTable data={detail!.records!} columns={detailColumns} sortable />
      ) : (
        <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>No failures flagged.</Paragraph>
      )}
    </>,
  );
}

/** Small subcomponent: per-mode definitions and "what good looks like" guidance. */
function FailureModeGuide({ budget }: { budget: number }) {
  const items: Array<{
    key: string;
    title: string;
    detect: string;
    why: string;
    good: string;
    fix: string;
  }> = [
    {
      key: "bloat",
      title: "Bloat",
      detect: `Main instruction file > ${budget} tokens (≈ ${Math.round(budget * 4 / 1000)}k characters).`,
      why: "Long main files crowd the context window. Agents skim later sections, ignore mid-file rules, and silently degrade as the file grows. Symptom: same advice gets ignored, especially anti-patterns buried halfway down.",
      good: `Main file ≤ ${budget} tokens. Stable conventions and long lists live in scoped rules files (.claude/rules/, .github/instructions/) loaded only when relevant. Main file is a short index that routes to detail.`,
      fix: "Move sections to rules files by topic (testing.md, dql.md, deployment.md). Keep main file as: project summary, file map, the 3–5 rules that ALWAYS apply, links to scoped rules.",
    },
    {
      key: "staleness",
      title: "Staleness",
      detect: "Main file present AND last edited > 90 days ago AND the repo itself has commits in the last 30 days.",
      why: "Active code + frozen instructions = drift. Agents follow obsolete patterns; reviewers waste cycles correcting the same thing. The repo's moving but its 'how to work here' isn't.",
      good: "Main file is touched whenever a convention changes. A heartbeat of small commits to CLAUDE.md / AGENTS.md is healthier than one big rewrite a year.",
      fix: "Add a 'review main file' line to your sprint checklist. Every PR that introduces a new pattern should update or link to the relevant rule. Champions (see table below) are the early-warning system here.",
    },
    {
      key: "missing_self_healing",
      title: "Missing self-heal",
      detect: "Main file present but contains no self-healing instruction (no phrase like 'flag the discrepancy', 'self-healing', 'contradicts these instructions', 'if you encounter a pattern').",
      why: "Without a self-heal directive, agents silently follow stale or contradictory rules instead of surfacing them. You only learn the context is wrong when something breaks in review.",
      good: "Main file contains an explicit instruction telling the agent to call out drift. Treats the context as a living system, not a one-shot prompt.",
      fix: "Add a section like: 'If you encounter a pattern in this codebase that contradicts these instructions, stop and flag the discrepancy. Do not silently follow either path.'",
    },
    {
      key: "vagueness",
      title: "Vagueness",
      detect: "Main file present AND > 500 tokens AND fewer than 3 anti-pattern markers (do not / never / avoid / forbidden / banned / don't).",
      why: "Positive-only instructions ('do X') underperform. Agents guess on edge cases and reproduce the patterns you're trying to remove. The high-value content is the explicit don'ts — that's where humans encode hard-won lessons.",
      good: "A 'Forbidden Patterns' or 'Anti-patterns' section with concrete don'ts ('never import from app/legacy/', 'do not call X directly — use Y', 'avoid setTimeout in tests'). Specific, not generic.",
      fix: "Walk through last quarter's review comments. Every 'please don't do this' that appeared more than once → an anti-pattern entry. Aim for ≥ 5 concrete don'ts in the main file or a dedicated anti-patterns rule.",
    },
    {
      key: "copy_paste",
      title: "Copy-paste",
      detect: "Two or more repos share an identical main file hash — the same content has been copied verbatim instead of tailored.",
      why: "A copied CLAUDE.md tells the agent generic things about a fictional 'this project' instead of the real one. Worst when teams template a starter file and never replace it. Agents end up with confident-sounding but wrong context.",
      good: "Each repo's main file is specific: file structure, real anti-patterns from THAT codebase, build/test commands that work HERE.",
      fix: "Identify the duplicate cluster (same hash). Pick one repo as the reference, tailor each clone to its own conventions. Shared rules belong in a separate rules file with a shared link, not duplicated content.",
    },
  ];

  return (
    <Flex flexDirection="column" gap={12} style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 4,
      padding: 16,
    }}>
      <Text style={{ fontSize: 11, opacity: 0.55, textTransform: "uppercase", letterSpacing: 1.2 }}>
        Definitions, thresholds, and what good looks like
      </Text>
      {items.map((it) => (
        <Flex key={it.key} flexDirection="column" gap={2} style={{ paddingTop: 6, borderTop: "1px dashed rgba(255,255,255,0.08)" }}>
          <Text style={{ fontSize: 12, fontWeight: 700 }}>{it.title}</Text>
          <Text style={{ fontSize: 11, opacity: 0.7 }}>
            <strong>Detected as:</strong> {it.detect}
          </Text>
          <Text style={{ fontSize: 11, opacity: 0.7 }}>
            <strong>Why it matters:</strong> {it.why}
          </Text>
          <Text style={{ fontSize: 11, opacity: 0.7 }}>
            <strong>What good looks like:</strong> {it.good}
          </Text>
          <Text style={{ fontSize: 11, opacity: 0.7 }}>
            <strong>How to tackle it:</strong> {it.fix}
          </Text>
        </Flex>
      ))}
      <Text style={{ fontSize: 11, opacity: 0.5, fontStyle: "italic", marginTop: 4 }}>
        Token estimates use the rough heuristic of 4 characters per token. The {budget}-token budget is a per-capability
        knob in <code>config.ts</code> / <code>repos.yaml</code> — raise it if your agent comfortably handles longer prompts,
        lower it if you see attention drop-off mid-file.
      </Text>
    </Flex>
  );
}

/* ── First-attempt PR pass rate (trend) ──────────────── */
function FirstAttemptPassTrend() {
  const { capability } = useCapability();
  const cfg = aiFirstConfig(capability);
  const query = aiPrFirstAttemptTrendQuery(capability);
  const { data, isLoading } = useDql({ query });

  const chartData = useMemo(
    () =>
      (data?.records ?? []).map((r) => ({
        category: String(r.week ?? ""),
        value: Math.round(Number(r.pass_rate) || 0),
      })),
    [data],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>AI-PR First-attempt Pass Rate</Heading>
        <QueryInspector query={query} title="First-attempt Pass Rate — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Percentage of AI-assisted PRs merged with zero NEEDS_WORK reviews. Target for
        {" "}{capability.label}: <strong>{cfg.passRateTarget}%</strong>.
      </Paragraph>
      {isLoading ? (
        loading()
      ) : chartData.length > 0 ? (
        <CategoricalBarChart data={chartData} layout="vertical">
          <CategoricalBarChart.Legend hidden />
        </CategoricalBarChart>
      ) : (
        empty("No AI-PR data in window")
      )}
    </>,
  );
}

/* ── Champions (table) ───────────────────────────────── */
function Champions() {
  const { capability } = useCapability();
  const query = aiChampionsQuery(capability);
  const { data, isLoading } = useDql({ query });

  const columns: Col[] = useMemo(
    () => [
      { id: "champion", accessor: "champion", header: "Champion", minWidth: 260 },
      { id: "repos", accessor: "repos", header: "Repos", minWidth: 80, alignment: "right" as const },
      {
        id: "total_touches",
        accessor: "total_touches",
        header: "Commits to context (90d)",
        minWidth: 200,
        alignment: "right" as const,
      },
    ],
    [],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Champions</Heading>
        <QueryInspector query={query} title="Champions — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Engineers actively maintaining context files (CLAUDE.md, AGENTS.md, .claude/rules, .claude/skills) — derived from
        Bitbucket commit history of those paths over the last 90 days. Champions emerge organically; you don't configure
        them. Repos with no champion show as empty here and indicate context is going stale.
      </Paragraph>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data!.records!} columns={columns} sortable />
      ) : (
        empty("No champion activity recorded")
      )}
    </>,
  );
}

/* ── Recent AI-assisted PRs (table) ──────────────────── */
function RecentAiPrs() {
  const { capability } = useCapability();
  const query = aiRecentPrsQuery(capability);
  const { data, isLoading } = useDql({ query });

  const columns: Col[] = useMemo(
    () => [
      { id: "repo", accessor: "repo", header: "Repo", minWidth: 160 },
      {
        id: "title",
        accessor: "title",
        header: "Title",
        minWidth: 280,
        cell: ({ value, rowData }: { value: unknown; rowData: ResultRecord }) => {
          const url = String(rowData.url ?? "");
          if (!url) return <span>{String(value ?? "")}</span>;
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {String(value ?? "")}
            </a>
          );
        },
      },
      { id: "author", accessor: "author", header: "Author", minWidth: 200 },
      {
        id: "first_pass",
        accessor: "first_pass",
        header: "1st pass",
        minWidth: 80,
        cell: ({ value }: { value: unknown }) => (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              color: value === true ? Colors.Charts.Apdex.Good.Default : Colors.Charts.Apdex.Poor.Default,
            }}
          >
            {bool(value)}
          </span>
        ),
      },
      { id: "rounds", accessor: "rounds", header: "Rounds", minWidth: 80, alignment: "right" as const },
      { id: "comments", accessor: "comments", header: "Comments", minWidth: 90, alignment: "right" as const },
      {
        id: "ttm_hours",
        accessor: "ttm_hours",
        header: "TTM (h)",
        minWidth: 90,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {Math.round(Number(value ?? 0))}
          </span>
        ),
      },
      { id: "merged", accessor: "merged", header: "Merged", minWidth: 200 },
    ],
    [],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Recent AI-assisted PRs (14 days)</Heading>
        <QueryInspector query={query} title="Recent AI PRs — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Detected via Co-authored-by, branch name, and tag heuristics.
      </Paragraph>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data!.records!} columns={columns} sortable />
      ) : (
        empty("No AI-PR activity in window")
      )}
    </>,
  );
}

/* ── Correction-cycle heatmap (table — repo × week) ──── */
function CorrectionHeatmap() {
  const { capability } = useCapability();
  const query = aiCorrectionHeatmapQuery(capability);
  const { data, isLoading } = useDql({ query });

  const columns: Col[] = useMemo(
    () => [
      { id: "repo", accessor: "repo", header: "Repo", minWidth: 180 },
      { id: "week", accessor: "week", header: "Week", minWidth: 100 },
      {
        id: "avg_comments",
        accessor: "avg_comments",
        header: "Avg comments / AI-PR",
        minWidth: 180,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => {
          const n = Number(value ?? 0);
          return (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                height: "100%",
                color:
                  n < 2
                    ? Colors.Charts.Apdex.Good.Default
                    : n < 5
                      ? Colors.Charts.Apdex.Fair.Default
                      : Colors.Charts.Apdex.Poor.Default,
              }}
            >
              {n.toFixed(1)}
            </span>
          );
        },
      },
      {
        id: "avg_rounds",
        accessor: "avg_rounds",
        header: "Avg rounds",
        minWidth: 110,
        alignment: "right" as const,
        cell: ({ value }: { value: unknown }) => (
          <span style={{ display: "flex", alignItems: "center", height: "100%" }}>
            {Number(value ?? 0).toFixed(2)}
          </span>
        ),
      },
      { id: "pr_count", accessor: "pr_count", header: "PRs", minWidth: 80, alignment: "right" as const },
    ],
    [],
  );

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Correction Cycles (12 weeks)</Heading>
        <QueryInspector query={query} title="Correction Heatmap — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Average comments and review rounds per AI-PR, by repo and week. Lower is better. An empty table means no
        AI-tagged PRs were detected in the window — either AI usage is genuinely low <em>or</em> engineers aren't
        tagging their AI commits (no <code>Co-authored-by</code> trailer, no <code>copilot/</code> branches).
      </Paragraph>
      {isLoading ? loading() : (data?.records?.length ?? 0) > 0 ? (
        <DataTable data={data!.records!} columns={columns} sortable />
      ) : (
        empty("No data in window")
      )}
    </>,
  );
}

/* ── AI vs human PR split (cards) ────────────────────── */
function AiVsHumanSplit() {
  const { capability } = useCapability();
  const query = aiPrSplitQuery(capability);
  const { data, isLoading } = useDql({ query });

  const rows = data?.records ?? [];
  const ai = rows.find((r) => r.is_ai === true) ?? rows.find((r) => r.cohort === "AI-assisted");
  const human = rows.find((r) => r.is_ai === false) ?? rows.find((r) => r.cohort === "Human-only");

  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>AI-assisted vs Human-only PRs (30 days)</Heading>
        <QueryInspector query={query} title="AI vs Human Split — DQL" />
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Paired comparison: same repos, same window, split by detected AI assistance.
      </Paragraph>
      <Paragraph style={{ opacity: 0.45, fontSize: 11, lineHeight: 1.5 }}>
        <strong>AI detection</strong> looks for <code>Co-authored-by: Claude/Copilot/Cursor</code> trailers, <code>copilot/</code>/<code>ai/</code>/<code>claude/</code> branch prefixes, and <code>[AI]</code> markers. Most engineers don't tag AI usage today, so the AI cohort is a lower bound — actual AI use is likely far higher.
        <br />
        <strong>First-attempt pass</strong> = no reviewer marked the PR as NEEDS_WORK. PAPA reviewers rarely use that status (they comment instead), so this rate sits near 100% for both cohorts. <em>Average comments</em> and <em>time to merge</em> are the more discriminating signals here.
      </Paragraph>
      {isLoading ? (
        loading()
      ) : !ai && !human ? (
        empty("No PR data in window")
      ) : (
        <Flex gap={32} flexWrap="wrap">
          <SplitBlock
            title="AI-assisted"
            color={Colors.Charts.Apdex.Good.Default}
            data={ai}
          />
          <SplitBlock
            title="Human-only"
            color={Colors.Charts.Apdex.Fair.Default}
            data={human}
          />
        </Flex>
      )}
    </>,
  );
}

function SplitBlock({
  title,
  color,
  data,
}: {
  title: string;
  color: string;
  data: ResultRecord | undefined;
}) {
  if (!data) {
    return (
      <Flex flexDirection="column" gap={4} style={{ minWidth: 220 }}>
        <Heading level={5} style={{ color }}>
          {title}
        </Heading>
        <Text style={{ opacity: 0.5 }}>No data</Text>
      </Flex>
    );
  }
  const total = Number(data.total_prs ?? 0);
  const passRate = Math.round(Number(data.pass_rate ?? 0));
  const rounds = Number(data.avg_rounds ?? 0).toFixed(2);
  const comments = Number(data.avg_comments ?? 0).toFixed(1);
  const ttm = Math.round(Number(data.avg_ttm_hours ?? 0));
  return (
    <Flex flexDirection="column" gap={4} style={{ minWidth: 220 }}>
      <Heading level={5} style={{ color }}>
        {title}
      </Heading>
      <Heading level={2} style={{ color, fontSize: 28 }}>
        {passRate}%
      </Heading>
      <Text style={{ opacity: 0.7, fontSize: 12 }}>First-attempt pass rate</Text>
      <Text style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>
        {total} PRs · avg {rounds} rounds · {comments} comments · {ttm}h to merge
      </Text>
    </Flex>
  );
}

/* ── Configuration card ─────────────────────────────── */
function ConfigurationCard() {
  const { capability } = useCapability();
  const cfg = aiFirstConfig(capability);
  const configured = cfg.repos.length > 0;
  return card(
    <>
      <Flex gap={8} alignItems="center">
        <Heading level={4}>Configuration</Heading>
      </Flex>
      <Paragraph style={{ opacity: 0.5, fontSize: 12 }}>
        Per-capability scanner config. Repos can be auto-discovered from Juno
        (Backstage catalog) via{" "}
        <code>scripts/ai-first-scanner/discover.py --update</code>, or pinned
        manually in <code>repos.yaml</code>.
      </Paragraph>
      {!configured ? (
        <Paragraph style={{ opacity: 0.7 }}>
          AI-First Adoption is not yet configured for {capability.label}. Add an
          <code> aiFirst</code> block in <code>ui/app/config.ts</code> and a
          matching capability entry in{" "}
          <code>scripts/ai-first-scanner/repos.yaml</code>, then run{" "}
          <code>python scan.py --config repos.yaml --capability "{capability.viProgram}" --emit</code>.
        </Paragraph>
      ) : (
        <Flex gap={32} flexWrap="wrap">
          <KpiBlock value={String(cfg.repos.length)} label="Repos monitored" />
          <KpiBlock value={`${cfg.mainTokenBudget}`} label="Main token budget" />
          <KpiBlock value={`${cfg.prWindowDays}d`} label="PR scan window" />
          <KpiBlock value={`${cfg.passRateTarget}%`} label="Pass-rate target" />
          <KpiBlock value={`${cfg.scoreTarget}`} label="Score target" />
        </Flex>
      )}
      {cfg.runbookUrl && (
        <Paragraph style={{ fontSize: 12 }}>
          <a
            href={cfg.runbookUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: Colors.Charts.Apdex.Excellent.Default }}
          >
            Scanner runbook ↗
          </a>
        </Paragraph>
      )}
    </>,
  );
}

/* ── Page ──────────────────────────────────────────────── */
export const AiFirst = () => {
  const { capability } = useCapability();
  const cfg = aiFirstConfig(capability);
  const configured = cfg.repos.length > 0;
  return (
    <Flex flexDirection="column" gap={24} padding={24}>
      <Heading level={2}>Pillar 5: AI-First Adoption</Heading>
      <Paragraph style={{ opacity: 0.7 }}>
        Context-engineering signals from across the capability's repositories. Driven by
        the AI-First scanner (scripts/ai-first-scanner/) plus PR review telemetry from
        Bitbucket. Mirrors the article's framework: the four context layers, six failure
        modes, and the maturity progression from autocomplete to full-stack.
      </Paragraph>
      <Paragraph style={{ opacity: 0.45, fontSize: 11, lineHeight: 1.5 }}>
        <strong>Caveat on AI-PR detection</strong>: signals are <code>Co-authored-by:</code> trailers (Claude/Copilot/Cursor),
        AI-prefixed branch names (<code>copilot/</code>, <code>ai/</code>, <code>claude/</code>), and explicit <code>[AI]</code> tags.
        Engineers using Copilot inline or Claude Code without those markers won't be counted — so the AI cohort here is a
        lower bound on real adoption, not the full picture. Push the team to keep co-author trailers on AI-assisted commits
        if you want a truer signal.
      </Paragraph>
      {!configured && <ConfigurationCard />}
      {configured && (
        <>
          <AdoptionHero />
          <Flex flexDirection="column" gap={16}>
            <FailureModes />
            <RepoScorecard />
            <FirstAttemptPassTrend />
            <MaturityFunnel />
            <AiVsHumanSplit />
            <CorrectionHeatmap />
            <Champions />
            <RecentAiPrs />
            <ConfigurationCard />
          </Flex>
        </>
      )}
    </Flex>
  );
};
