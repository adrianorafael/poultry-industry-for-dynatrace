import React from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { LINE_NOMINAL, PLANT_ID, PLANT_NAME } from "../sim/model";
import type { SparkKey } from "../sim/types";
import { BRAND, LEVEL_COLOR, LEVEL_TEXT, type Level } from "../theme/colors";
import { useApp, useSnapshot } from "../state/engine-context";
import { fmtDec, fmtInt, fmtPct } from "../format";
import { SourceTag } from "./SourceTag";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Counter that rolls digit by digit. */
export const Odometer = ({ text }: { text: string }) => {
  const chars = text.split("");
  return (
    <span className="ff-odo" aria-label={text}>
      {chars.map((ch, i) => {
        const key = chars.length - i;
        if (!/\d/.test(ch))
          return (
            <span key={key} className="ff-odo-sep" aria-hidden>
              {ch}
            </span>
          );
        return (
          <span key={key} className="ff-odo-digit" aria-hidden>
            <span className="ff-odo-strip" style={{ transform: `translateY(-${Number(ch) * 10}%)` }}>
              {DIGITS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
};

export const Sparkline = ({ data, color, width = 110, height = 26 }: { data: number[]; color: string; width?: number; height?: number }) => {
  const pts = data.slice(-30);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts
    .map((v, i) => `${((i / (pts.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} className="ff-spark" aria-hidden>
      <polyline points={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
};

interface Tile {
  key: SparkKey;
  label: string;
  value: React.ReactNode;
  text: string;
  sub: string;
  level?: Level;
}

export const KpiRibbon = () => {
  const snap = useSnapshot();
  const { select, prefs } = useApp();
  const theme = useCurrentTheme();
  const k = snap.kpi;
  const L = snap.kpiLevel;
  const P = snap.pcp.today;
  const inShift = k.linePlan > 0;
  const tiles: Tile[] = [
    { key: "health", label: "Saúde da cadeia", value: fmtInt(k.health), text: fmtInt(k.health), sub: "índice 0–100", level: L.health },
    {
      key: "birds",
      label: "Aves abatidas hoje",
      value: <Odometer text={fmtInt(k.birdsToday)} />,
      text: fmtInt(k.birdsToday),
      sub:
        P.adherence !== null
          ? `${fmtPct(P.adherence, 1)} do plano até agora`
          : P.planBirds > 0
            ? `plano do dia ${fmtInt(P.planBirds)}`
            : `${fmtDec((snap.mass.liveKg || 0) / 1000, 0)} t de peso vivo`,
      level: L.birds,
    },
    {
      key: "line",
      label: "Ritmo do abate",
      value: inShift ? `${fmtInt(k.lineRate)}/h` : "—",
      text: `${fmtInt(k.lineRate)} aves por hora`,
      sub: inShift ? `${fmtInt(k.linePct)}% do plano` : snap.shift,
      level: L.line,
    },
    { key: "yield", label: "Rendimento de carcaça", value: fmtPct(k.yield, 1), text: fmtPct(k.yield, 1), sub: "carcaça ÷ peso vivo", level: L.yield },
    {
      key: "condemn",
      label: "DOA + condenação total",
      value: fmtPct(k.condemnPct, 2),
      text: fmtPct(k.condemnPct, 2),
      sub: `parcial ${fmtPct(k.partialPct, 1)} das carcaças`,
      level: L.condemn,
    },
    {
      key: "storage",
      label: "Câmara fria",
      value: fmtPct(k.storagePct, 1),
      text: fmtPct(k.storagePct, 1),
      sub: `${fmtInt(k.storagePallets)} paletes · ${fmtDec(k.storageTemp, 1)} °C`,
      level: L.storage,
    },
    {
      key: "finished",
      label: "Produto acabado hoje",
      value: (
        <>
          <Odometer text={fmtDec(k.finishedT, 1)} /> t
        </>
      ),
      text: `${fmtDec(k.finishedT, 1)} t`,
      sub: `${fmtInt(k.boxesToday)} caixas`,
    },
    {
      key: "shipped",
      label: "Expedido hoje",
      value: (
        <>
          <Odometer text={fmtDec(k.shippedT, 1)} /> t
        </>
      ),
      text: `${fmtDec(k.shippedT, 1)} t`,
      sub: `${fmtInt(k.loadsToday)} cargas · exportação ${fmtInt(k.exportPct)}%`,
    },
    {
      key: "nfe",
      label: "NF-e · autorização",
      value: snap.nfeMode === "normal" || snap.nfeMode === "svc" ? `${fmtDec(k.nfeP95, 1)} s` : snap.nfeMode === "cert" ? "cStat 281" : `cStat ${snap.sefazStatus.code}`,
      text: k.sefaz,
      sub: k.heldLoads > 0 ? `${fmtInt(k.heldLoads)} carga(s) retida(s)` : snap.nfeMode === "normal" ? `p95 · ${k.sefaz}` : k.sefaz,
      level: L.nfe,
    },
  ];
  return (
    <div className={`ff-kpis ${prefs.tv ? "ff-kpis-tv" : ""} ${snap.speed >= 10 ? "ff-odo-still" : ""}`}>
      <div className="ff-brand">
        <img src={theme === "dark" ? "./assets/logo-white.svg" : "./assets/logo.svg"} alt="Poultry Industry" className="ff-brand-logo" />
        <div className="ff-brand-text">
          <strong>Unidade {PLANT_ID}</strong>
          <span>{PLANT_NAME}</span>
          <span>
            2 × {fmtInt(LINE_NOMINAL)} aves/h · {snap.shift}
          </span>
        </div>
      </div>
      {tiles.map((t) => {
        const bg = t.level ? LEVEL_COLOR[t.level] : undefined;
        const fg = t.level ? LEVEL_TEXT[t.level] : undefined;
        return (
          <button
            key={t.key}
            id={`kpi-${t.key}`}
            type="button"
            className={`ff-kpi ${t.level ? "ff-kpi-status" : ""}`}
            style={{ background: bg, color: fg }}
            onClick={() => select({ type: "kpi", key: t.key })}
            aria-label={`${t.label}: ${t.text}${t.level ? ` (${t.level})` : ""}`}
          >
            <span className="ff-kpi-label">{t.label}</span>
            <span className="ff-kpi-foot">
              <span className="ff-kpi-value">{t.value}</span>
              <Sparkline data={snap.spark[t.key]} color={t.level ? (fg ?? "#FFFFFF") : BRAND.teal} width={44} height={18} />
            </span>
            <span className="ff-kpi-sub">{t.sub}</span>
          </button>
        );
      })}
      <SourceTag text="Business Events de pesagem, abate, embalagem, estoque, carga e NF-e (OpenPipeline) + métricas OT; saúde composta por SLOs de cada elo da cadeia" />
    </div>
  );
};
