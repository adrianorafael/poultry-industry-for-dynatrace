import React, { useMemo } from "react";
import { TopList } from "@dynatrace/strato-components/charts";
import { FAMILY_COLOR, LEVEL_COLOR } from "../theme/colors";
import { useApp, useSnapshot } from "../state/engine-context";
import { fmtDec, fmtInt, fmtPct } from "../format";
import { Panel } from "./Panel";

const LOSS = { trim: "#C9A48E", cond: "#9E4A4A", doa: "#5E4B4B", inedible: "#8C939F" };

/** Mass balance: where each live kilogram goes, today. */
export const YieldPanel = () => {
  const snap = useSnapshot();
  const { select } = useApp();
  const m = snap.mass;
  const live = Math.max(1, m.liveKg);
  const segs = [
    { key: "carcass", label: "Carcaça", kg: m.carcassKg, color: FAMILY_COLOR.Cortes },
    { key: "paws", label: "Patas", kg: m.pawsKg, color: FAMILY_COLOR["Miúdos e patas"] },
    { key: "giblets", label: "Miúdos", kg: m.gibletsKg, color: FAMILY_COLOR.Inteiro },
    { key: "trim", label: "Refile (cond. parcial)", kg: m.trimKg, color: LOSS.trim },
    { key: "cond", label: "Condenação total", kg: m.condemnedKg, color: LOSS.cond },
    { key: "doa", label: "DOA", kg: m.doaKg, color: LOSS.doa },
    { key: "inedible", label: "Sangue, penas, vísceras", kg: m.inedibleKg, color: LOSS.inedible },
  ];
  let x = 0;
  const causes = useMemo(
    () =>
      snap.partialCauses
        .map((c) => ({ label: c.label, count: Math.round(c.count) }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
    [snap.partialCauses],
  );
  const totalTop = [...snap.totalCauses].sort((a, b) => b.count - a.count).slice(0, 3);
  const yieldLevel = snap.kpiLevel.yield;
  return (
    <Panel
      title="Rendimento e condenas · hoje"
      right={
        <span className="ff-yield-head" style={{ color: LEVEL_COLOR[yieldLevel] }}>
          {fmtPct(snap.kpi.yield, 1)}
        </span>
      }
      source="Pesagens (vivo e produto acabado) como Business Events; condenações do SIF por causa e por linha (sistema de inspeção) via OpenPipeline"
      className="ff-yield"
    >
      <button type="button" className="ff-mass" onClick={() => select({ type: "kpi", key: "yield" })} aria-label="Balanço de massa do dia">
        <svg viewBox="0 0 400 34" preserveAspectRatio="none" className="ff-mass-bar" aria-hidden>
          {segs.map((s) => {
            const w = (400 * s.kg) / live;
            const r = <rect key={s.key} x={x} y={2} width={Math.max(0, w)} height={30} fill={s.color} />;
            x += w;
            return r;
          })}
        </svg>
        <span className="ff-mass-legend">
          {segs.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} />
              {s.label} <b>{fmtPct((100 * s.kg) / live, s.kg / live < 0.01 ? 2 : 1)}</b>
            </span>
          ))}
        </span>
        <span className="ff-mass-sum ff-muted">
          {fmtDec(m.liveKg / 1000, 1)} t de peso vivo → {fmtDec(m.finishedKg / 1000, 1)} t de produto acabado
        </span>
      </button>
      <div className="ff-causes">
        <span className="ff-card-k">Condenação parcial por causa (carcaças)</span>
        {causes.length > 0 ? (
          <TopList data={causes} labelAccessor="label" valueAccessor="count" height={132} valueFormatter={(v: number) => fmtInt(v)} />
        ) : (
          <div className="ff-empty">Sem abate ainda hoje.</div>
        )}
        {totalTop.length > 0 && (
          <div className="ff-muted ff-causes-total">
            Condenação total: {totalTop.map((c) => `${c.label} ${fmtInt(c.count)}`).join(" · ")}
          </div>
        )}
      </div>
    </Panel>
  );
};
