import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";
import { Select, SelectOption, SelectContent } from "@dynatrace/strato-components/forms";
import { CAPABILITIES, CAPABILITY_KEYS } from "../config";
import { useCapability } from "../CapabilityContext";

export const Header = () => {
  const { capKey, setCapKey } = useCapability();

  return (
    <AppHeader>
      <AppHeader.NavItems>
        <AppHeader.AppNavLink as={Link} to="/" />
        <AppHeader.NavItem as={Link} to="/value">
          Unlock Value
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/quality">
          Quality
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/predictability">
          Predictability
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/devex">
          DevEx
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/ai-first">
          AI-First
        </AppHeader.NavItem>
      </AppHeader.NavItems>
      <AppHeader.ActionItems>
        <div style={{ minWidth: 220 }}>
          <Select
            value={capKey}
            onChange={(val) => val && setCapKey(String(val))}
          >
            <SelectContent>
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
