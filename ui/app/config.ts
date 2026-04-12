/**
 * Capability configuration for AI-First Observer.
 *
 * Change DEFAULT_CAPABILITY to switch the default view.
 * The capability key maps to `owning Program` (for VIs) and `project` (for bugs/stories).
 */

export interface Capability {
  /** Display name shown in the UI */
  label: string;
  /** Value of `owning Program` in jira_daily.valueincrement events */
  viProgram: string;
  /** Value of `project` in jira_daily.bug / jira_daily.story events */
  bugProject: string;
}

/** Registry of known capabilities */
export const CAPABILITIES: Record<string, Capability> = {
  PAPA: {
    label: "Platform Apps (PAPA)",
    viProgram: "Platform Apps",
    bugProject: "Platform Apps",
  },
  DAQ: {
    label: "Data Acquisition",
    viProgram: "Data Acquisition",
    bugProject: "Data Acquisition",
  },
  OA: {
    label: "OneAgent",
    viProgram: "OneAgent",
    bugProject: "OneAgent",
  },
  DX: {
    label: "Digital Experience",
    viProgram: "Digital Experience",
    bugProject: "Digital Experience",
  },
  GRAIL: {
    label: "Grail",
    viProgram: "Grail",
    bugProject: "Grail",
  },
  APPOBS: {
    label: "Application Observability",
    viProgram: "Application Observability",
    bugProject: "Application Observability",
  },
  APPDEV: {
    label: "App Development",
    viProgram: "App Development",
    bugProject: "App Development",
  },
};

export const DEFAULT_CAPABILITY = "PAPA";
export const CAPABILITY_KEYS = Object.keys(CAPABILITIES);
