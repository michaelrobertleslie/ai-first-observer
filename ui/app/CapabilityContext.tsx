import React, { createContext, useContext, useState, type ReactNode } from "react";
import { CAPABILITIES, DEFAULT_CAPABILITY, type Capability } from "./config";

interface CapabilityContextValue {
  capKey: string;
  capability: Capability;
  setCapKey: (key: string) => void;
}

const CapabilityContext = createContext<CapabilityContextValue>({
  capKey: DEFAULT_CAPABILITY,
  capability: CAPABILITIES[DEFAULT_CAPABILITY],
  setCapKey: () => {},
});

export function CapabilityProvider({ children }: { children: ReactNode }) {
  const [capKey, setCapKey] = useState(DEFAULT_CAPABILITY);
  const capability = CAPABILITIES[capKey] ?? CAPABILITIES[DEFAULT_CAPABILITY];
  return (
    <CapabilityContext.Provider value={{ capKey, capability, setCapKey }}>
      {children}
    </CapabilityContext.Provider>
  );
}

export function useCapability() {
  return useContext(CapabilityContext);
}
