import React from "react";
import { LEVEL_COLOR, LEVEL_LABEL } from "../theme/colors";
import { useApp, useSnapshot } from "../state/engine-context";
import { LevelIcon } from "./LevelIcon";
import { Panel } from "./Panel";

/** The chain in order, one row per link: utilization, status, the current constraint and back-pressure. */
export const ChainPanel = () => {
  const snap = useSnapshot();
  const { select } = useApp();
  const constraint = snap.stages.find((s) => s.constraint);
  return (
    <Panel
      title="Gargalos da cadeia"
      source="Business Flow sobre os Business Events de cada etapa (ID da carga / do caminhão como correlação) + métricas OT de capacidade; restrição e propagação calculadas por Dynatrace Intelligence"
      className="ff-chain"
    >
      <div className={`ff-constraint ${constraint ? `ff-constraint-${constraint.level}` : ""}`} role="status">
        <span className="ff-card-k">{constraint ? "Restrição atual" : "Situação"}</span>
        <span>{snap.constraint.text}</span>
      </div>
      <ol className="ff-chain-list">
        {snap.stages.map((s, i) => (
          <li key={s.id} className={s.constraint ? "ff-chain-constraint" : ""}>
            <button type="button" className="ff-chain-row" onClick={() => select({ type: "stage", id: s.id })} aria-label={`${s.label}: ${s.value} (${LEVEL_LABEL[s.level]})`}>
              <span className="ff-chain-idx">{i + 1}</span>
              <span className="ff-chain-name">
                <span>{s.label}</span>
                <small>
                  {s.value}
                  {s.note && <b> · {s.note}</b>}
                </small>
              </span>
              <span className="ff-chain-bar" aria-hidden>
                <i style={{ width: `${Math.min(100, Math.max(2, s.util * 100))}%`, background: LEVEL_COLOR[s.level] }} />
              </span>
              <span className="ff-chain-bp" title={s.pressure ? "Contrapressão: este elo já sente a restrição a jusante" : undefined}>
                {s.pressure ? "▲" : ""}
              </span>
              <LevelIcon level={s.level} color={LEVEL_COLOR[s.level]} mark={s.level === "warning" ? "#1B1B1B" : "#FFFFFF"} size={13} />
            </button>
          </li>
        ))}
      </ol>
      <div className="ff-chain-legend ff-muted">▲ contrapressão: o elo sente a restrição que está mais adiante na cadeia</div>
    </Panel>
  );
};
