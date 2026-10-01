import React from "react";
import { ChainPanel } from "../components/ChainPanel";
import { ExpeditionPanel } from "../components/ExpeditionPanel";
import { IntelligenceDrawer } from "../components/IntelligenceDrawer";
import { KpiRibbon } from "../components/KpiRibbon";
import { LiveBirdsPanel } from "../components/LiveBirdsPanel";
import { NfePanel } from "../components/NfePanel";
import { SourceTag } from "../components/SourceTag";
import { YieldPanel } from "../components/YieldPanel";
import { PlantScene } from "../scene/PlantScene";
import { useApp } from "../state/engine-context";

export const Live = () => {
  const { prefs } = useApp();
  return (
    <div className={`ff-live ${prefs.tv ? "ff-tv" : ""}`}>
      <KpiRibbon />
      <div className="ff-main">
        <section className="ff-panel ff-scene-panel" aria-label="Planta">
          <PlantScene />
          <SourceTag text="Cada caminhão, caixa e carga é um Business Event; equipamentos (galpão, linhas, amônia, câmara, balanças) via OpenTelemetry; portaria e NF-e via ERP e mensageria" />
        </section>
        <div className="ff-side">
          <ChainPanel />
        </div>
      </div>
      <IntelligenceDrawer />
      <div className="ff-bottom">
        <LiveBirdsPanel />
        <YieldPanel />
        <NfePanel />
        <ExpeditionPanel />
      </div>
    </div>
  );
};
