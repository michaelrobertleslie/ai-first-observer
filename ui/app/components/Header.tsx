import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";
import { Select, SelectOption, SelectContent } from "@dynatrace/strato-components/forms";
import { CAPABILITIES, CAPABILITY_KEYS } from "../config";
import { useCapability } from "../CapabilityContext";
import { PILLAR_COLORS } from "../pages/Overview";

// Tab content: dot + label as siblings inside a flex span. Flex centring
// avoids the baseline-vs-cap-height mismatch that misaligns inline elements.
const TabContent = ({ color, label }: { color: string; label: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, lineHeight: 1 }}>
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
    <span>{label}</span>
  </span>
);

export const Header = () => {
  const { capKey, setCapKey } = useCapability();
  const isPapa = capKey === "PAPA";

  return (
    <AppHeader>
      <AppHeader.NavItems>
        <AppHeader.AppNavLink
          as={Link}
          to="/"
          {...(isPapa
            ? { appName: "AI-First Observer · PAPA", appIcon: "./assets/papa-logo.png" }
            : {})}
        />
        <AppHeader.NavItem as={Link} to="/ai-first">
          <TabContent color={PILLAR_COLORS[0]} label="AI-First" />
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/value">
          <TabContent color={PILLAR_COLORS[1]} label="Unlock Value" />
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/quality">
          <TabContent color={PILLAR_COLORS[2]} label="Quality" />
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/predictability">
          <TabContent color={PILLAR_COLORS[3]} label="Predictability" />
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/devex">
          <TabContent color={PILLAR_COLORS[4]} label="DevEx" />
        </AppHeader.NavItem>
      </AppHeader.NavItems>
      <AppHeader.ActionItems>
        <div style={{ minWidth: 280 }}>
          <Select
            value={capKey}
            onChange={(val) => val && setCapKey(String(val))}
          >
            <SelectContent width="360px">
              {CAPABILITY_KEYS.map((k) => (
                <SelectOption key={k} value={k}>
                  {CAPABILITIES[k].label}
                </SelectOption>
              ))}
            </SelectContent>
          </Select>
        </div>
      </AppHeader.ActionItems>
    </AppHeader>
  );
};
