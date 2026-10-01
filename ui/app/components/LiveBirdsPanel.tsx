import React from "react";
import { fmtClock } from "../sim/time";
import { LEVEL_COLOR, LEVEL_TEXT } from "../theme/colors";
import { useApp, useSnapshot } from "../state/engine-context";
import { fmtDec, fmtInt, fmtPct } from "../format";
import { Panel } from "./Panel";
import { StatusPill } from "./StatusPill";

export const LiveBirdsPanel = () => {
  const snap = useSnapshot();
  const { select } = useApp();
  const inShed = snap.bays.filter((b) => b.truckId);
  const maxWait = inShed.length ? Math.max(...inShed.map((b) => b.waitMin)) : 0;
  const shedLevel = snap.shedTemp > 31 ? "critical" : snap.shedTemp > 28.5 ? "warning" : "ok";
  return (
    <Panel
      title="Balança de frango vivo · galpão"
      right={<StatusPill level={shedLevel} text={`${fmtDec(snap.shedTemp, 1)} °C${snap.fansOk ? "" : " · V-04 parado"}`} />}
      source="Tickets da balança (indicador → gateway → sistema de integração) como Business Events; ventiladores, nebulizadores e temperatura do galpão via OpenTelemetry (CLP)"
      className="ff-birds"
    >
      <div className="ff-mini-stats">
        <span>
          <b>{inShed.length}</b> no galpão
        </span>
        <span>
          <b>{fmtInt(maxWait)} min</b> espera máx.
        </span>
        <span>
          <b>{fmtPct(snap.doaPct, 2)}</b> DOA
        </span>
        <span>
          <b>{fmtInt(snap.platformBirds)}</b> aves na pendura
        </span>
      </div>
      <div className="ff-bays" aria-label="Baias do galpão de espera">
        {snap.bays.map((b, i) => (
          <button
            key={i}
            type="button"
            className={`ff-bay ${b.truckId ? "" : "ff-bay-empty"}`}
            style={b.truckId ? { background: LEVEL_COLOR[b.level], color: LEVEL_TEXT[b.level] } : undefined}
            onClick={() => b.truckId && select({ type: "truck", id: b.truckId })}
            aria-label={b.truckId ? `Baia ${i + 1}: ${b.truckId}, ${fmtInt(b.waitMin)} min de espera` : `Baia ${i + 1} livre`}
          >
            {b.truckId ? `${fmtInt(b.waitMin)}′` : ""}
          </button>
        ))}
      </div>
      <div className="ff-feed-list ff-weigh-list">
        {snap.weighings.length === 0 && <div className="ff-empty">Aguardando o primeiro caminhão do dia…</div>}
        {snap.weighings.slice(0, 8).map((w) => (
          <button key={w.id} type="button" className="ff-feed-row ff-weigh-row" onClick={() => select({ type: "truck", id: w.truckId })}>
            <span className="ff-feed-time">{fmtClock(w.t)}</span>
            <span className="ff-feed-id">{w.truckId}</span>
            <span className={`ff-tag ff-tag-${w.kind}`}>{w.kind === "bruto" ? "bruto" : "tara"}</span>
            {w.kind === "bruto" ? (
              <>
                <span className="ff-feed-value">{fmtInt(w.grossKg)} kg</span>
                <span className="ff-feed-cat" title={w.farm}>
                  {fmtInt(w.birds)} aves · {w.farm}
                </span>
              </>
            ) : (
              <>
                <span className="ff-feed-value">{fmtInt(w.netKg ?? 0)} kg líq.</span>
                <span className="ff-feed-cat">
                  {fmtDec(w.kgPerBird ?? 0, 2)} kg/ave · DOA {fmtInt(w.doa ?? 0)}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
    </Panel>
  );
};
