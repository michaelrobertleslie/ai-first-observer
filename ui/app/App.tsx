import { Page } from "@dynatrace/strato-components-preview/layouts";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { CapabilityProvider } from "./CapabilityContext";
import { Overview } from "./pages/Overview";
import { UnlockValue } from "./pages/UnlockValue";
import { Quality } from "./pages/Quality";
import { Predictability } from "./pages/Predictability";
import { DevExperience } from "./pages/DevExperience";
import { AiFirst } from "./pages/AiFirst";

export const App = () => {
  return (
    <CapabilityProvider>
      <Page>
        <Page.Header>
          <Header />
        </Page.Header>
        <Page.Main>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/value" element={<UnlockValue />} />
            <Route path="/quality" element={<Quality />} />
            <Route path="/predictability" element={<Predictability />} />
            <Route path="/devex" element={<DevExperience />} />
            <Route path="/ai-first" element={<AiFirst />} />
          </Routes>
        </Page.Main>
      </Page>
    </CapabilityProvider>
  );
};
