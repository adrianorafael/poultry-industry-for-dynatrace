import React, { useCallback, useEffect, useRef } from "react";
import { fmtClock } from "../sim/time";
import type { Nfe } from "../sim/types";
import { LEVEL_COLOR, STATUS, type Level } from "../theme/colors";
import { useApp, useFrame, useSnapshot } from "../state/engine-context";
import { usePrefersReducedMotion } from "../state/use-reduced-motion";
import { fmtBrl, fmtDec, fmtInt } from "../format";
import { Panel } from "./Panel";
import { StatusPill } from "./StatusPill";

interface NodeDef {
  x: number;
  y: number;
  label: [string, string];
}

const NODES: Record<string, NodeDef> = {
  balPA: { x: 40, y: 80, label: ["Balança", "PA · ticket"] },
  erp: { x: 124, y: 80, label: ["ERP", "faturamento"] },
  msg: { x: 210, y: 80, label: ["Mensageria", "NF-e"] },
  sefaz: { x: 306, y: 40, label: ["SEFAZ-PR", "autorizadora"] },
  svc: { x: 306, y: 122, label: ["SVC-RS", "contingência"] },
  proto: { x: 400, y: 80, label: ["Protocolo", "cStat 100"] },
  danfe: { x: 484, y: 80, label: ["DANFE", "MDF-e"] },
  portaria: { x: 562, y: 80, label: ["Portaria", "saída"] },
};

const EDGES: [string, string, boolean?][] = [
  ["balPA", "erp"],
  ["erp", "msg"],
  ["msg", "sefaz"],
  ["msg", "svc", true],
  ["sefaz", "proto"],
  ["svc", "proto", true],
  ["proto", "danfe"],
  ["danfe", "portaria"],
];

const NS = "http://www.w3.org/2000/svg";

interface Particle {
  el: SVGCircleElement;
  pts: { x: number; y: number }[];
  t: number;
  dur: number;
}

class Particles {
  private list: Particle[] = [];
  private last = 0;

  constructor(private layer: SVGGElement) {}

  add(route: string[], color: string): void {
    if (this.list.length > 60) return;
    const el = document.createElementNS(NS, "circle");
    el.setAttribute("r", "4.5");
    el.setAttribute("fill", color);
    el.setAttribute("stroke", "rgba(0,0,0,0.35)");
    el.setAttribute("stroke-width", "0.8");
    this.layer.appendChild(el);
    this.list.push({ el, pts: route.map((id) => ({ x: NODES[id].x, y: NODES[id].y })), t: 0, dur: 0.55 * (route.length - 1) });
  }

  render(now: number): void {
    const dt = this.last ? Math.min(100, now - this.last) / 1000 : 0;
    this.last = now;
    this.list = this.list.filter((p) => {
      p.t += dt;
      const u = Math.min(1, p.t / p.dur) * (p.pts.length - 1);
      const i = Math.min(p.pts.length - 2, Math.floor(u));
      const f = u - i;
      const a = p.pts[i];
      const b = p.pts[i + 1];
      p.el.setAttribute("cx", (a.x + (b.x - a.x) * f).toFixed(1));
      p.el.setAttribute("cy", (a.y + (b.y - a.y) * f).toFixed(1));
      if (p.t >= p.dur) {
        p.el.remove();
        return false;
      }
      return true;
    });
  }

  clear(): void {
    for (const p of this.list) p.el.remove();
    this.list = [];
  }
}

function cStatLevel(n: { cStat: number; state: Nfe["state"] }): Level {
  if (n.cStat === 100) return "ok";
  if (n.state === "rejected" || n.cStat === 109 || n.cStat === 281) return "critical";
  if (n.cStat === 108) return "warning";
  return "neutral";
}

export const NfePanel = () => {
  const snap = useSnapshot();
  const { engine, select } = useApp();
  const reduced = usePrefersReducedMotion();
  const layer = useRef<SVGGElement>(null);
  const parts = useRef<Particles | null>(null);

  useEffect(() => {
    if (!layer.current) return;
    const p = new Particles(layer.current);
    parts.current = p;
    const offSent = engine.on("nfeSent", (n) => {
      if (reduced) return;
      p.add(["erp", "msg", n.tpEmis === 7 ? "svc" : "sefaz"], "#6BA7E8");
    });
    const offResult = engine.on("nfeResult", (n) => {
      if (reduced) return;
      const from = n.tpEmis === 7 ? "svc" : "sefaz";
      if (n.state === "authorized") p.add([from, "proto", "danfe", "portaria"], STATUS.ok);
      else p.add([from, "msg"], n.state === "rejected" ? STATUS.critical : STATUS.warning);
    });
    return () => {
      offSent();
      offResult();
      p.clear();
    };
  }, [engine, reduced]);

  const onFrame = useCallback((now: number) => parts.current?.render(now), []);
  useFrame(onFrame);

  const t = snap.nfeToday;
  const modeText =
    snap.nfeMode === "normal"
      ? "Emissão normal · tpEmis 1"
      : snap.nfeMode === "svc"
        ? "Contingência SVC-RS · tpEmis 7"
        : snap.nfeMode === "cert"
          ? "Certificado vencido · cStat 281"
          : `SEFAZ-PR indisponível · cStat ${snap.sefazStatus.code}`;
  const modeLevel: Level = snap.nfeMode === "normal" ? "ok" : snap.nfeMode === "svc" ? "warning" : "critical";
  return (
    <Panel
      title="Faturamento · NF-e · SEFAZ"
      right={<StatusPill level={modeLevel} text={modeText} />}
      source="Traces do ERP e da mensageria (OneAgent), logs com cStat e validade do certificado, Business Events por NF-e e monitor sintético do serviço de status da SEFAZ; troca para SVC-RS por Workflow"
      className="ff-nfe"
    >
      <svg viewBox="0 0 600 160" className="ff-pipe-svg" role="img" aria-label="Fluxo da NF-e">
        {EDGES.map(([a, b, dashed]) => {
          const A = NODES[a];
          const B = NODES[b];
          const bad = (b === "sefaz" && snap.nfeNodes.sefaz === "critical") || (a === "sefaz" && snap.nfeNodes.sefaz === "critical");
          return (
            <line
              key={`${a}-${b}`}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              className={`ff-edge ${dashed && snap.nfeMode !== "svc" ? "ff-edge-dashed" : ""} ${bad ? "ff-edge-bad" : ""}`}
            />
          );
        })}
        {Object.entries(NODES).map(([id, n]) => {
          const lvl = snap.nfeNodes[id] ?? "ok";
          return (
            <g key={id} transform={`translate(${n.x},${n.y})`}>
              <rect x={-38} y={-18} width={76} height={36} rx={7} className="ff-node-box" stroke={LEVEL_COLOR[lvl]} strokeWidth={lvl === "ok" || lvl === "neutral" ? 1.2 : 2.6} />
              <text y={-3} textAnchor="middle" className="ff-node-label">
                {n.label[0]}
              </text>
              <text y={10} textAnchor="middle" className="ff-node-sub">
                {n.label[1]}
              </text>
            </g>
          );
        })}
        <g transform={`translate(${NODES.msg.x - 38},${NODES.msg.y + 22})`}>
          <rect width={76} height={16} rx={4} fill={LEVEL_COLOR[snap.nfeNodes.cert ?? "ok"]} />
          <text x={38} y={11.5} textAnchor="middle" fontSize={9} fontWeight={700} fill={snap.nfeNodes.cert === "warning" ? "#1B1B1B" : "#FFFFFF"}>
            {snap.certDays > 0 ? `cert. A1: ${fmtInt(snap.certDays)} dias` : "cert. A1 vencido"}
          </text>
        </g>
        {t.queue > 0 && (
          <g transform={`translate(${NODES.msg.x + 30},${NODES.msg.y - 26})`}>
            <circle r={10} fill={STATUS.critical} />
            <text y={3.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#FFFFFF">
              {t.queue}
            </text>
          </g>
        )}
        <g ref={layer} />
      </svg>
      <div className="ff-mini-stats">
        <span>
          <b>{fmtInt(t.authorized)}</b> autorizadas hoje
        </span>
        <span>
          <b>{fmtInt(t.rejected)}</b> rejeitadas
        </span>
        <span>
          <b>{fmtInt(t.svc)}</b> em contingência
        </span>
        <span>
          <b>{fmtDec(snap.kpi.nfeP95, 1)} s</b> p95
        </span>
        <span>
          <b>{fmtInt(t.pendingLoads)}</b> cargas aguardando
        </span>
      </div>
      <div className="ff-feed-list ff-nfe-list">
        {snap.nfeFeed.length === 0 && <div className="ff-empty">Nenhuma nota emitida ainda hoje.</div>}
        {snap.nfeFeed.slice(0, 7).map((n) => (
          <button key={`${n.number}-${n.cStat}`} type="button" className="ff-feed-row ff-nfe-row" onClick={() => select({ type: "load", id: n.loadId })}>
            <span className="ff-feed-time">{fmtClock(n.t)}</span>
            <span className="ff-feed-id">NF {String(n.number).padStart(6, "0")}</span>
            <span className="ff-feed-cat">
              {n.dest} · CFOP {n.cfop}
            </span>
            <span className="ff-feed-value">{fmtBrl(n.valueBrl)}</span>
            <StatusPill level={cStatLevel(n)} text={n.cStat > 0 ? `cStat ${n.cStat}` : "enviada"} />
            <span className="ff-feed-cat">
              tpEmis {n.tpEmis}
              {n.latencyS !== undefined && n.cStat === 100 ? ` · ${fmtDec(n.latencyS, 1)} s` : ""}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
};
