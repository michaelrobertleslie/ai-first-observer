/**
 * Capability configuration for AI-First Observer.
 *
 * Change DEFAULT_CAPABILITY to switch the default view.
 * The capability key maps to `owning Program` (for VIs) and `project` (for bugs/stories).
 */

export interface ScorecardAsset {
  label: string;
  asset: string;
}

export interface JunoLink {
  label: string;
  url: string;
}

export interface Capability {
  /** Display name shown in the UI */
  label: string;
  /** Value of `owning Program` in jira_daily.valueincrement events */
  viProgram: string;
  /** Value of `project` in jira_daily.bug / jira_daily.story events */
  bugProject: string;
  /** Juno software catalog URL for this capability */
  junoCatalogUrl: string;
  /** Component scorecards (dashboard links) */
  scorecardAssets?: ScorecardAsset[];
  /** Additional Juno catalog links (systems/SDKs without a scorecard dashboard) */
  junoLinks?: JunoLink[];
  /** URL to external adoption metrics dashboard (optional) */
  adoptionDashboardUrl?: string;
}

const SCORECARD_BASE = "https://dre63214.apps.dynatrace.com/ui/apps/dynatrace.dashboards/dashboard/monaco-643204c8-ddb7-3891-9842-063f1dc1b1cf#from=now%28%29-14d&to=now%28%29&vfilter_assetVersion=summary&vfilter_asset=";

export function scorecardUrl(asset: string): string {
  return `${SCORECARD_BASE}${encodeURIComponent(asset)}`;
}

/** Build a Jira issue URL from a key like "PLAT-12345" */
export function jiraUrl(key: string): string {
  return `https://dt-rnd.atlassian.net/browse/${encodeURIComponent(key)}`;
}

/** Build a Jira JQL search URL */
export function jiraSearchUrl(jql: string): string {
  return `https://dt-rnd.atlassian.net/issues/?jql=${encodeURIComponent(jql)}`;
}

/** Registry of known capabilities */
export const CAPABILITIES: Record<string, Capability> = {
  PAPA: {
    label: "Platform Apps (PAPA)",
    viProgram: "Platform Apps",
    bugProject: "Platform Apps",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/platform-apps-papa",
    scorecardAssets: [
      { label: "Dashboards", asset: "dashboards" },
      { label: "Dashboards CLI", asset: "dashboard-cli" },
      { label: "AppShell", asset: "app-shell" },
      { label: "Intent Explorer", asset: "dynatrace.intent.explorer-app" },
      { label: "Onion Logs", asset: "dynatrace.onion.logs-app" },
      { label: "Launcher", asset: "launcher" },
      { label: "Notebooks", asset: "notebooks" },
      { label: "Search Service", asset: "search-service" },
      { label: "SmartScape App", asset: "dynatrace.smartscape-app" },
    ],
    junoLinks: [
      { label: "Data Exploration (SDK)", url: "https://juno.internal.dynatrace.com/catalog/default/system/data-exploration" },
      { label: "DQL Builder (SDK)", url: "https://juno.internal.dynatrace.com/catalog/dynatrace-sdk/component/dynatrace-sdk_dql-builder" },
    ],
    adoptionDashboardUrl: "https://ntd44713.apps.dynatrace.com/ui/document/v0/#share=ce7379d5-4ead-4af1-921b-54fcac39382e",
  },
  PS: {
    label: "Platform Services",
    viProgram: "Platform Services",
    bugProject: "Platform Services",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/platform-services",
  },
  OA: {
    label: "OneAgent",
    viProgram: "OneAgent",
    bugProject: "OneAgent Capability",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/oneagent",
  },
  DX: {
    label: "Digital Experience",
    viProgram: "Digital Experience",
    bugProject: "Digital Experience Capability",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/digital-experience",
  },
  APPDEV: {
    label: "App Development",
    viProgram: "App Development",
    bugProject: "App Development",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/app-development",
  },
  GRAIL: {
    label: "Grail",
    viProgram: "Grail",
    bugProject: "Grail",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/grail",
  },
  APPOBS: {
    label: "Application Observability",
    viProgram: "Application Observability",
    bugProject: "Application Observability",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/application-observability",
  },
  ASDY: {
    label: "App & Service Delivery",
    viProgram: "App & Service Delivery",
    bugProject: "App & Service Delivery",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/app-service-delivery",
  },
  QSP: {
    label: "Quality, Security, Privacy",
    viProgram: "Quality, Security, Privacy",
    bugProject: "Quality, Security, Privacy",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/quality-security-privacy",
  },
  SIA: {
    label: "Security Intelligence Automation",
    viProgram: "Security Intelligence Automation",
    bugProject: "Security Intelligence Automation",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/security-intelligence-automation",
  },
  LIC: {
    label: "Licensing",
    viProgram: "Licensing",
    bugProject: "Licensing",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/licensing",
  },
  DAQ: {
    label: "Data Acquisition",
    viProgram: "Data Acquisition",
    bugProject: "Data Acquisition",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/data-acquisition",
  },
  CLIN: {
    label: "Cloud & Infrastructure",
    viProgram: "Cloud & Infrastructure",
    bugProject: "Cloud & Infrastructure",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/cloud-infrastructure",
  },
  DI: {
    label: "Data Intelligence",
    viProgram: "Data Intelligence",
    bugProject: "Data Intelligence",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/data-intelligence",
  },
  CA: {
    label: "Cloud Automation",
    viProgram: "Cloud Automation",
    bugProject: "Cloud Automation",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/cloud-automation",
  },
  MANAGED: {
    label: "Managed",
    viProgram: "Managed",
    bugProject: "Managed",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/managed",
  },
  INFOBS: {
    label: "Infrastructure Observability",
    viProgram: "Infrastructure Observability",
    bugProject: "Infrastructure Observability",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/infrastructure-observability",
  },
  ICP: {
    label: "Ingest Control Plane",
    viProgram: "Ingest Control Plane",
    bugProject: "Ingest Control Plane",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/ingest-control-plane",
  },
  SRE: {
    label: "Site Reliability Engineering",
    viProgram: "Site Reliability Engineering",
    bugProject: "Site Reliability Engineering",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/site-reliability-engineering",
  },
  BA: {
    label: "Business Analytics",
    viProgram: "Business Analytics",
    bugProject: "Business Analytics",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/business-analytics",
  },
  PPX: {
    label: "OpenPipeline",
    viProgram: "OpenPipeline",
    bugProject: "OpenPipeline",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/openpipeline",
  },
  PFSC: {
    label: "Platform Success",
    viProgram: "Platform Success",
    bugProject: "Platform Success",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/platform-success",
  },
  DESIGN: {
    label: "Design Foundations",
    viProgram: "Design Foundations",
    bugProject: "Design Foundations",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/design-foundations",
  },
  DEVREL: {
    label: "Developer Relations",
    viProgram: "Developer Relations",
    bugProject: "Developer Relations",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/developer-relations",
  },
  PCC: {
    label: "Product Compliance & Certifications",
    viProgram: "Product Compliance and Certifications",
    bugProject: "Product Compliance and Certifications",
    junoCatalogUrl: "https://juno.internal.dynatrace.com/catalog/capability/group/product-compliance-and-certifications",
  },
};

export const DEFAULT_CAPABILITY = "PAPA";
export const CAPABILITY_KEYS = Object.keys(CAPABILITIES);
