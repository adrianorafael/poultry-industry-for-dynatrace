import React from "react";
import { DonutChart } from "@dynatrace/strato-components/charts";
import { VEHICLES } from "../sim/model";
import { LEVEL_COLOR, MARKET_COLOR } from "../theme/colors";
import { useApp, useSnapshot } from "../state/engine-context";
import { fmtDec, fmtInt, fmtT, fmtUsd } from "../format";
import { Panel } from "./Panel";
import { StatusPill } from "./StatusPill";

export const ExpeditionPanel = () => {
  const snap = useSnapshot();
  const { select } = useApp();
  const e = snap.expedition;
  const split = [
    { market: "Exportação", t: e.exportKg / 1000 },
    { market: "Mercado interno", t: e.domesticKg / 1000 },
  ].filter((s) => s.t > 0);
  const top = [...e.byCountry].sort((a, b) => b.kg - a.kg).slice(0, 4);
  return (
    <Panel
      title="Expedição · hoje"
      right={<span className="ff-muted">{fmtInt(e.loads)} cargas · {fmtT(e.exportKg + e.domesticKg, 0)}</span>}
      source="WMS (picking e docas), balança e portaria como Business Events; bookings e cut-off do armador por API; DU-E vinculada à chave da NF-e"
      className="ff-exp"
    >
      <div className="ff-exp-top">
        <div className="ff-exp-donut">
          {split.length > 0 ? (
            <DonutChart
              data={split}
              labelAccessor="market"
              valueAccessor="t"
              height={118}
              colorPalette={{ Exportação: MARKET_COLOR.EXP, "Mercado interno": MARKET_COLOR.MI }}
              formatter={(v: number) => `${fmtDec(v, 0)} t`}
            >
              <DonutChart.Legend hidden />
            </DonutChart>
          ) : (
            <div className="ff-empty">Sem expedição ainda hoje.</div>
          )}
        </div>
        <div className="ff-exp-legend">
          <span>
            <i style={{ background: MARKET_COLOR.EXP }} />
            Exportação <b>{fmtT(e.exportKg, 0)}</b> · {fmtUsd(e.exportUsd)}
          </span>
          <span>
            <i style={{ background: MARKET_COLOR.MI }} />
            Mercado interno <b>{fmtT(e.domesticKg, 0)}</b>
          </span>
          <span className="ff-muted">{top.map((c) => `${c.name} ${fmtDec(c.kg / 1000, 0)} t`).join(" · ") || "—"}</span>
          <span className="ff-muted">
            Porto: {e.inTransit} a caminho · {e.cutoffRisk} em risco de cut-off{e.missedCutoff ? ` · ${e.missedCutoff} perderam` : ""}
          </span>
        </div>
      </div>
      <div className="ff-docks">
        {snap.docks.map((d) => (
          <button
            key={d.id}
            type="button"
            className="ff-dock-row"
            onClick={() => (d.loadId ? select({ type: "load", id: d.loadId }) : select({ type: "stage", id: "docas" }))}
          >
            <span className="ff-dock-id">D{d.id}</span>
            {d.loadId && d.vehicle ? (
              <>
                <span className="ff-dock-load">
                  <i style={{ background: MARKET_COLOR[d.market ?? "MI"] }} />
                  {d.loadId} · {VEHICLES[d.vehicle].label.split(" ")[0]} → {d.dest}
                </span>
                {d.state === "blocked" ? (
                  <StatusPill level="critical" text="presa" />
                ) : (
                  <span className="ff-dock-bar">
                    <i style={{ width: `${Math.round(d.progress * 100)}%`, background: LEVEL_COLOR.ok }} />
                  </span>
                )}
              </>
            ) : (
              <span className="ff-muted">livre</span>
            )}
          </button>
        ))}
      </div>
      <div className="ff-mini-stats">
        <span>
          <b>{snap.yard.waitingDock}</b> aguardando doca
        </span>
        <span>
          <b>{snap.yard.waitingNfe}</b> aguardando NF-e
        </span>
        <span>
          <b>{snap.yard.outside}</b> fora da portaria
        </span>
      </div>
    </Panel>
  );
};
