import React, { useCallback, useEffect, useRef } from "react";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import { PRODUCTS, STORAGE_PALLETS } from "../sim/model";
import type { StageId } from "../sim/types";
import { FAMILY_COLOR, LEVEL_COLOR, SCENE, STATUS, type Level } from "../theme/colors";
import { useApp, useFrame, useSnapshot } from "../state/engine-context";
import { usePrefersReducedMotion } from "../state/use-reduced-motion";
import { fmtDec, fmtInt } from "../format";
import {
  ANTE,
  bayPos,
  CUTTING,
  dockPos,
  EXPORT_EXIT_Y,
  FG_SCALE,
  FV_SCALE_IN,
  FV_SCALE_OUT,
  GATE,
  GRID,
  HIGHLIGHT,
  LINE_X0,
  LINE_X1,
  LINE_Y,
  MACHINES,
  PLATFORM,
  RENDERING,
  ROAD_IN_Y,
  ROAD_OUT_Y,
  ROAD_Y,
  SCENE_H,
  SCENE_W,
  SHED,
  SLAUGHTER,
  STATIONS,
  STORE,
  TUNNEL_BOX,
  YARD,
  yardPos,
} from "./geometry";
import { TruckLayer } from "./trucks";

interface FlowRef {
  el: SVGPathElement | null;
  rate: number;
  offset: number;
}

const FLOW_KEYS = ["l1", "l2", "unload", "pack", "t0", "t1", "t2", "store", "cond"] as const;
type FlowKey = (typeof FLOW_KEYS)[number];

const Label = ({ x, y, children, anchor = "start", size = 11, weight = 700, dim = false }: {
  x: number;
  y: number;
  children: React.ReactNode;
  anchor?: "start" | "middle" | "end";
  size?: number;
  weight?: number;
  dim?: boolean;
}) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} className={dim ? "ff-scene-dim" : "ff-scene-label"}>
    {children}
  </text>
);

export const PlantScene = () => {
  const { engine, select } = useApp();
  const snap = useSnapshot();
  const theme = useCurrentTheme() === "dark" ? "dark" : "light";
  const P = SCENE[theme];
  const reduced = usePrefersReducedMotion();
  const truckLayer = useRef<SVGGElement>(null);
  const badgeLayer = useRef<SVGGElement>(null);
  const trucks = useRef<TruckLayer | null>(null);
  const flows = useRef<Record<FlowKey, FlowRef>>(
    Object.fromEntries(FLOW_KEYS.map((k) => [k, { el: null, rate: 0, offset: 0 }])) as unknown as Record<FlowKey, FlowRef>,
  );
  const lastFrame = useRef(0);
  const palette = useRef(P);
  palette.current = P;

  // flow rates (0–1 of nominal) for the conveyor animation, refreshed with the snapshot
  const f = flows.current;
  f.l1.rate = snap.lines[0].rate / 7500;
  f.l2.rate = snap.lines[1].rate / 7500;
  f.unload.rate = snap.flows.unloading ? 1 : 0;
  f.pack.rate = snap.flows.pack / 1850;
  snap.tunnels.forEach((t, i) => {
    f[`t${i}` as FlowKey].rate = t.accepting ? snap.flows.tunnelIn / 2200 : 0;
  });
  f.store.rate = snap.flows.putaway / 1850;
  f.cond.rate = snap.lines.some((l) => l.rate > 100) ? Math.max(...snap.lines.map((l) => l.contamination)) / 1.2 : 0;

  useEffect(() => {
    if (!truckLayer.current || !badgeLayer.current) return;
    const layer = new TruckLayer(truckLayer.current, badgeLayer.current, (kind, id) => select({ type: kind, id }));
    trucks.current = layer;
    return () => layer.clear();
  }, [select, theme]);

  const onFrame = useCallback(
    (now: number) => {
      const dt = lastFrame.current ? Math.min(100, now - lastFrame.current) / 1000 : 0;
      lastFrame.current = now;
      trucks.current?.render(engine, palette.current);
      if (reduced || engine.paused) return;
      const k = Math.sqrt(Math.max(engine.speed, 0.01) / 60);
      for (const key of FLOW_KEYS) {
        const fl = flows.current[key];
        if (!fl.el) continue;
        fl.offset -= 38 * Math.min(2.5, fl.rate) * k * dt;
        fl.el.style.strokeDashoffset = fl.offset.toFixed(1);
      }
    },
    [engine, reduced],
  );
  useFrame(onFrame);

  const flowRef = (key: FlowKey) => (el: SVGPathElement | null) => {
    flows.current[key].el = el;
  };
  const stage = (id: StageId) => () => select({ type: "stage", id });

  // cold store grid
  const cells = GRID.cols * GRID.rows;
  const perCell = STORAGE_PALLETS / cells;
  const families = ["Inteiro", "Cortes", "Miúdos e patas", "Industrializados"];
  const famPallets = families.map((fam) =>
    snap.storageByProduct.filter((p) => PRODUCTS.find((x) => x.id === p.id)?.family === fam).reduce((s, p) => s + p.pallets, 0),
  );
  const cellColors: string[] = [];
  let carry = 0;
  families.forEach((fam, i) => {
    const n = Math.round((famPallets[i] + carry) / perCell);
    carry = famPallets[i] + carry - n * perCell;
    for (let j = 0; j < n && cellColors.length < cells; j++) cellColors.push(FAMILY_COLOR[fam]);
  });

  const hl = snap.highlight ? HIGHLIGHT[snap.highlight] : undefined;
  const heat = !snap.fansOk;
  const tunnelScenario = snap.scenarios.find((s) => s.id === "tunnel");
  const c3Down = (tunnelScenario?.k ?? 0) > 0.05;
  const nfeLevel: Level = snap.nfeMode === "normal" ? "ok" : snap.nfeMode === "svc" ? "warning" : "critical";
  const shedLevel: Level = snap.shedTemp > 31 ? "critical" : snap.shedTemp > 28.5 ? "warning" : "ok";

  return (
    <svg className="ff-scene" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} role="img" aria-label="Planta frigorífica: da balança de frango vivo à portaria">
      <rect x={0} y={0} width={SCENE_W} height={SCENE_H} fill={P.ground} />
      {/* roads */}
      <g fill={P.road}>
        <rect x={0} y={ROAD_IN_Y - 14} width={172} height={28} />
        <rect x={0} y={ROAD_OUT_Y - 14} width={PLATFORM.x + 14} height={28} />
        <rect x={PLATFORM.x - 14} y={PLATFORM.y} width={28} height={ROAD_OUT_Y - PLATFORM.y + 14} />
        <rect x={0} y={ROAD_Y - 16} width={820} height={32} />
        <rect x={0} y={EXPORT_EXIT_Y - 10} width={70} height={20} />
        <rect x={YARD.x - 10} y={YARD.y - 6} width={YARD.w + 20} height={YARD.h + 12} rx={6} />
        <rect x={YARD.x + YARD.w} y={YARD.y - 6} width={STORE.x - YARD.x - YARD.w} height={STORE.h + 12} />
        <rect x={760} y={YARD.y + YARD.h} width={60} height={ROAD_Y - YARD.y - YARD.h} />
      </g>
      <g stroke={P.roadLine} strokeWidth={1.4} strokeDasharray="10 12" opacity={0.7}>
        <line x1={0} y1={ROAD_IN_Y} x2={60} y2={ROAD_IN_Y} />
        <line x1={0} y1={ROAD_OUT_Y} x2={60} y2={ROAD_OUT_Y} />
        <line x1={0} y1={ROAD_Y} x2={20} y2={ROAD_Y} />
      </g>
      <Label x={6} y={ROAD_IN_Y - 22} size={10} dim>
        ← Granjas integradas
      </Label>
      <Label x={6} y={ROAD_OUT_Y + 26} size={10} dim>
        ← retorno às granjas
      </Label>
      <Label x={6} y={ROAD_Y - 24} size={10} dim>
        ← Mercado interno
      </Label>
      <Label x={6} y={EXPORT_EXIT_Y + 16} size={10} dim>
        ← Porto de Paranaguá · 600 km
      </Label>

      {/* live-bird scale */}
      <g className="ff-clickable" onClick={stage("balFV")}>
        <rect x={FV_SCALE_IN.x - 38} y={ROAD_IN_Y - 16} width={76} height={32} rx={3} fill="none" stroke={P.roadLine} strokeWidth={2} />
        <rect x={FV_SCALE_OUT.x - 38} y={ROAD_OUT_Y - 16} width={76} height={32} rx={3} fill="none" stroke={P.roadLine} strokeWidth={2} />
        <Label x={FV_SCALE_IN.x} y={ROAD_IN_Y + 32} anchor="middle" size={10}>
          Balança frango vivo
        </Label>
        <Label x={FV_SCALE_IN.x} y={ROAD_IN_Y + 44} anchor="middle" size={9} dim weight={500}>
          bruto na entrada
        </Label>
        <Label x={FV_SCALE_OUT.x} y={ROAD_OUT_Y - 22} anchor="middle" size={9} dim weight={500}>
          tara na saída
        </Label>
      </g>

      {/* holding shed */}
      <g className="ff-clickable" onClick={stage("aves")}>
        <rect x={SHED.x} y={SHED.y} width={SHED.w} height={SHED.h} rx={8} fill={P.building} stroke={P.buildingEdge} strokeWidth={1.5} />
        {Array.from({ length: 14 }, (_, i) => {
          const b = bayPos(i);
          return <rect key={i} x={b.x - 14} y={b.y - 34} width={28} height={68} rx={3} fill="none" stroke={P.buildingEdge} strokeDasharray="3 3" />;
        })}
        <Label x={SHED.x + 10} y={SHED.y + 16}>
          Galpão de espera
        </Label>
        <text x={SHED.x + 10} y={SHED.y + SHED.h / 2 + 4} fontSize={11} fontWeight={700} fill={LEVEL_COLOR[shedLevel]}>
          {fmtDec(snap.shedTemp, 1)} °C
        </text>
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(${SHED.x + 162 + i * 22},${SHED.y + 10})`}>
            <circle r={8} fill={P.room} stroke={heat ? STATUS.critical : P.buildingEdge} strokeWidth={1.4} />
            <g className={heat || reduced ? "" : "ff-spin"}>
              <path d="M0,-6 L2,0 L0,6 L-2,0 Z M-6,0 L0,-2 L6,0 L0,2 Z" fill={heat ? STATUS.critical : P.labelDim} />
            </g>
          </g>
        ))}
        <Label x={SHED.x + 150} y={SHED.y + 32} size={9} dim weight={500}>
          {heat ? "V-04 parado" : "ventilação"}
        </Label>
      </g>

      {/* unloading platform */}
      <rect x={PLATFORM.x - 16} y={PLATFORM.y - 40} width={32} height={80} rx={3} fill={P.room} stroke={P.buildingEdge} />
      <Label x={PLATFORM.x} y={PLATFORM.y + 56} anchor="middle" size={9} dim weight={600}>
        Pendura
      </Label>

      {/* slaughter building */}
      <g className="ff-clickable" onClick={stage("linha")}>
        <rect x={SLAUGHTER.x} y={SLAUGHTER.y} width={SLAUGHTER.w} height={SLAUGHTER.h} rx={8} fill={P.building} stroke={P.buildingEdge} strokeWidth={1.5} />
        <Label x={SLAUGHTER.x + 10} y={SLAUGHTER.y + 16}>
          Abate · 2 linhas
        </Label>
        {STATIONS.map((s) => {
          const evisc = s.id === "evisc" && snap.lines[1].contamination > 3;
          return (
            <g key={s.id} onClick={s.id === "sif" ? (e) => (e.stopPropagation(), select({ type: "stage", id: "inspecao" })) : undefined}>
              <rect x={s.x} y={58} width={s.w} height={190} rx={5} fill={P.room} stroke={P.buildingEdge} />
              {evisc && <rect x={s.x} y={LINE_Y[1] - 20} width={s.w} height={40} rx={5} fill={STATUS.critical} opacity={0.35} />}
              {s.label.map((ln, i) => (
                <Label key={ln} x={s.x + s.w / 2} y={236 + i * 11 - (s.label.length - 1) * 11} anchor="middle" size={9} dim weight={600}>
                  {ln}
                </Label>
              ))}
            </g>
          );
        })}
        {LINE_Y.map((y, i) => {
          const ln = snap.lines[i];
          const lvl: Level = ln.stopped && ln.plan > 0 ? "warning" : ln.sifReduced ? "critical" : "ok";
          return (
            <g key={y}>
              <line x1={LINE_X0} y1={y} x2={LINE_X1} y2={y} stroke={P.conveyor} strokeWidth={2} />
              <path
                ref={flowRef(i === 0 ? "l1" : "l2")}
                d={`M${LINE_X0},${y} L${LINE_X1},${y}`}
                stroke="#F6E7C8"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray="0.1 9"
                fill="none"
                opacity={ln.rate > 50 ? 1 : 0.25}
              />
              <text x={LINE_X0 + 6} y={y - 10} fontSize={10} fontWeight={700} fill={LEVEL_COLOR[lvl]}>
                L{i + 1} · {ln.plan > 0 ? `${fmtInt(ln.rate)}/h` : "parada"}
                {ln.sifReduced ? " · SIF" : ln.stopped && ln.plan > 0 ? ` · ${ln.stopped.toLowerCase()}` : ""}
              </text>
            </g>
          );
        })}
        <path ref={flowRef("unload")} d={`M${PLATFORM.x + 12},${PLATFORM.y} L${LINE_X0},${LINE_Y[0]} M${PLATFORM.x + 12},${PLATFORM.y} L${LINE_X0},${LINE_Y[1]}`} stroke="#F6E7C8" strokeWidth={4} strokeLinecap="round" strokeDasharray="0.1 7" fill="none" />
      </g>

      {/* rendering (condemned) */}
      <g className="ff-clickable" onClick={stage("inspecao")}>
        <path ref={flowRef("cond")} d={`M921,${LINE_Y[1] + 10} L921,${RENDERING.y}`} stroke={STATUS.critical} strokeWidth={4} strokeLinecap="round" strokeDasharray="0.1 12" fill="none" />
        <rect x={RENDERING.x} y={RENDERING.y} width={RENDERING.w} height={RENDERING.h} rx={4} fill={P.room} stroke={P.buildingEdge} />
        <Label x={RENDERING.x + RENDERING.w / 2} y={RENDERING.y + 17} anchor="middle" size={9} dim weight={600}>
          Graxaria · condenas
        </Label>
      </g>

      {/* cutting, processed, packaging */}
      <g className="ff-clickable" onClick={stage("embalagem")}>
        <rect x={CUTTING.x} y={CUTTING.y} width={CUTTING.w} height={CUTTING.h} rx={8} fill={P.building} stroke={P.buildingEdge} strokeWidth={1.5} />
        {[
          ["Sala de cortes", "peito · coxa · sobrecoxa · asa", 58],
          ["Miúdos e patas", "coração · fígado · moela · patas", 120],
          ["Industrializados", "salsicha · a passarinho · empanados", 182],
        ].map(([t, s, y]) => (
          <g key={t}>
            <rect x={CUTTING.x + 8} y={Number(y)} width={CUTTING.w - 16} height={52} rx={5} fill={P.room} stroke={P.buildingEdge} />
            <Label x={CUTTING.x + 16} y={Number(y) + 20} size={10}>
              {t}
            </Label>
            <Label x={CUTTING.x + 16} y={Number(y) + 36} size={8.5} dim weight={500}>
              {s}
            </Label>
          </g>
        ))}
        <Label x={CUTTING.x + 10} y={CUTTING.y + 16}>
          Cortes e embalagem
        </Label>
        <path d={`M${LINE_X1},157 L${CUTTING.x + 8},157`} stroke={P.conveyor} strokeWidth={3} />
        <path ref={flowRef("pack")} d={`M${CUTTING.x + 20},272 L${ANTE.x + 6},272`} stroke={P.cage} strokeWidth={7} strokeDasharray="7 7" fill="none" />
        <Label x={CUTTING.x + 20} y={264} size={9} dim weight={600}>
          Embalagem → {fmtInt(snap.flows.pack)} cx/h
        </Label>
      </g>

      {/* antecâmara */}
      <g className="ff-clickable" onClick={stage("ante")}>
        <rect x={ANTE.x} y={ANTE.y} width={ANTE.w} height={ANTE.h} rx={8} fill={P.roomCold} stroke={P.buildingEdge} strokeWidth={1.5} />
        <rect
          x={ANTE.x + 14}
          y={ANTE.y + 40 + (ANTE.h - 70) * (1 - Math.min(1, snap.anteUtil))}
          width={ANTE.w - 28}
          height={(ANTE.h - 70) * Math.min(1, snap.anteUtil)}
          rx={3}
          fill={LEVEL_COLOR[snap.anteUtil > 0.9 ? "critical" : snap.anteUtil > 0.6 ? "warning" : "ok"]}
          className="ff-fill"
        />
        <rect x={ANTE.x + 14} y={ANTE.y + 40} width={ANTE.w - 28} height={ANTE.h - 70} rx={3} fill="none" stroke={P.buildingEdge} />
        <Label x={ANTE.x + ANTE.w / 2} y={ANTE.y + 16} anchor="middle" size={10}>
          Ante-
        </Label>
        <Label x={ANTE.x + ANTE.w / 2} y={ANTE.y + 28} anchor="middle" size={10}>
          câmara
        </Label>
        <Label x={ANTE.x + ANTE.w / 2} y={ANTE.y + ANTE.h - 14} anchor="middle" size={11}>
          {fmtInt(snap.anteUtil * 100)}%
        </Label>
      </g>

      {/* freezing tunnels */}
      <g className="ff-clickable" onClick={stage("tuneis")}>
        {snap.tunnels.map((t, i) => {
          const b = TUNNEL_BOX(i);
          return (
            <g key={i}>
              <path ref={flowRef(`t${i}` as FlowKey)} d={`M${ANTE.x + ANTE.w},${b.y + b.h / 2} L${b.x + 4},${b.y + b.h / 2}`} stroke={P.cage} strokeWidth={6} strokeDasharray="6 6" fill="none" />
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={P.roomCold} stroke={LEVEL_COLOR[t.level]} strokeWidth={t.level === "ok" ? 1.2 : 2.6} />
              <rect x={b.x + 8} y={b.y + 30} width={(b.w - 16) * Math.min(1, t.util)} height={14} rx={3} fill="#7FB7E6" className="ff-fill" />
              <rect x={b.x + 8} y={b.y + 30} width={b.w - 16} height={14} rx={3} fill="none" stroke={P.buildingEdge} />
              <Label x={b.x + 8} y={b.y + 18} size={10}>
                Túnel {i + 1}
              </Label>
              <text x={b.x + b.w - 8} y={b.y + 18} textAnchor="end" fontSize={11} fontWeight={800} fill={LEVEL_COLOR[t.level]}>
                {fmtDec(t.temp, 0)} °C
              </text>
              <Label x={b.x + 8} y={b.y + 58} size={9} dim weight={500}>
                {fmtInt(t.util * 100)}% · {fmtDec(t.dwellH, 0)} h para −18 °C{t.accepting ? "" : t.blocked ? " · saída travada" : " · sem receber"}
              </Label>
            </g>
          );
        })}
      </g>
      <g className="ff-clickable" onClick={stage("tuneis")}>
        <rect x={MACHINES.x} y={MACHINES.y} width={MACHINES.w} height={MACHINES.h} rx={6} fill={P.building} stroke={P.buildingEdge} />
        <Label x={MACHINES.x + 8} y={MACHINES.y + 22} size={9} dim weight={600}>
          Casa de máquinas NH₃
        </Label>
        {[1, 2, 3, 4, 5].map((c, i) => {
          const down = c === 3 && c3Down;
          return (
            <g key={c} transform={`translate(${MACHINES.x + 128 + i * 22},${MACHINES.y + 18})`}>
              <circle r={8} fill={down ? STATUS.critical : c === 5 ? P.room : STATUS.ok} stroke={P.buildingEdge} />
              <text y={3} textAnchor="middle" fontSize={7.5} fontWeight={800} fill={c === 5 && !down ? P.labelDim : "#FFFFFF"}>
                C{c}
              </text>
            </g>
          );
        })}
      </g>
      <path ref={flowRef("store")} d={`M1596,78 L1596,${STORE.y + 20}`} stroke={P.cage} strokeWidth={6} strokeDasharray="6 8" fill="none" />

      {/* cold store */}
      <g className="ff-clickable" onClick={stage("camara")}>
        <rect x={STORE.x} y={STORE.y} width={STORE.w} height={STORE.h} rx={8} fill={P.roomCold} stroke={LEVEL_COLOR[snap.kpiLevel.storage]} strokeWidth={snap.kpiLevel.storage === "ok" ? 1.5 : 3} />
        <Label x={STORE.x + 16} y={STORE.y + 22}>
          Câmara fria · {fmtDec(snap.kpi.storagePct, 1)}% · {fmtInt(snap.kpi.storagePallets)} paletes · {fmtDec(snap.kpi.storageTemp, 1)} °C
        </Label>
        {Array.from({ length: cells }, (_, i) => {
          const col = i % GRID.cols;
          const row = GRID.rows - 1 - Math.floor(i / GRID.cols);
          return (
            <rect
              key={i}
              x={GRID.x + col * GRID.cw}
              y={GRID.y + row * GRID.ch}
              width={GRID.cw - 3}
              height={GRID.ch - 4}
              rx={2}
              fill={cellColors[i] ?? P.room}
              opacity={cellColors[i] ? 0.95 : 0.55}
            />
          );
        })}
        <g transform={`translate(${STORE.x + STORE.w - 330},${STORE.y + 12})`}>
          {families.map((fam, i) => (
            <g key={fam} transform={`translate(${i * 84},0)`}>
              <rect width={9} height={9} rx={2} fill={FAMILY_COLOR[fam]} />
              <text x={13} y={8.5} fontSize={9} className="ff-scene-dim">
                {fam}
              </text>
            </g>
          ))}
        </g>
      </g>

      {/* docks */}
      <g className="ff-clickable" onClick={stage("docas")}>
        {snap.docks.map((d, i) => {
          const p = dockPos(i);
          const color = d.state === "blocked" ? STATUS.critical : d.state === "loading" ? STATUS.ok : P.buildingEdge;
          return (
            <g key={d.id}>
              <rect x={STORE.x - 5} y={p.y - 16} width={9} height={32} rx={2} fill={color} />
              <Label x={STORE.x + 8} y={p.y + 4} size={9} dim weight={700}>
                D{d.id}
              </Label>
            </g>
          );
        })}
      </g>

      {/* yard */}
      <g className="ff-clickable" onClick={stage("portaria")}>
        {Array.from({ length: 10 }, (_, i) => {
          const p = yardPos(i);
          return <rect key={i} x={p.x - 13} y={p.y - 34} width={26} height={68} rx={3} fill="none" stroke={P.roadLine} strokeDasharray="4 3" opacity={0.7} />;
        })}
        <text x={YARD.x + 4} y={YARD.y + YARD.h + 22} fontSize={11} fontWeight={700} fill={P.label}>
          Pátio · {snap.yard.used}/10 vagas
          {snap.kpi.heldLoads > 0 ? ` · ${snap.kpi.heldLoads} retida(s)` : ""}
        </text>
      </g>

      {/* finished-goods scale */}
      <g className="ff-clickable" onClick={stage("balPA")}>
        <rect x={FG_SCALE.x - 40} y={ROAD_Y - 16} width={80} height={32} rx={3} fill="none" stroke={snap.ticketsDown ? STATUS.critical : P.roadLine} strokeWidth={2} />
        <rect x={FG_SCALE.x - 36} y={ROAD_Y - 52} width={72} height={24} rx={4} fill={P.room} stroke={P.buildingEdge} />
        <circle cx={FG_SCALE.x - 24} cy={ROAD_Y - 40} r={5} fill={snap.ticketsDown ? STATUS.critical : STATUS.ok} className={snap.ticketsDown ? "ff-blink-crit" : ""} />
        <Label x={FG_SCALE.x - 14} y={ROAD_Y - 36} size={9}>
          Balança PA
        </Label>
      </g>

      {/* gate + NF-e */}
      <g className="ff-clickable" onClick={stage("nfe")}>
        <rect x={GATE.x - 30} y={ROAD_Y - 76} width={60} height={42} rx={5} fill={P.building} stroke={LEVEL_COLOR[nfeLevel]} strokeWidth={nfeLevel === "ok" ? 1.2 : 2.6} />
        <path d={`M${GATE.x - 18},${ROAD_Y - 69} h14 l6,6 v18 h-20 Z`} fill={P.room} stroke={P.buildingEdge} />
        <circle cx={GATE.x + 14} cy={ROAD_Y - 58} r={6} fill={LEVEL_COLOR[nfeLevel]} className={nfeLevel === "critical" ? "ff-blink-crit" : ""} />
        <Label x={GATE.x} y={ROAD_Y - 82} anchor="middle" size={10}>
          Portaria · NF-e
        </Label>
        <line x1={GATE.x + 22} y1={ROAD_Y - 16} x2={GATE.x + 22} y2={ROAD_Y + 16} stroke={nfeLevel === "ok" ? STATUS.ok : STATUS.critical} strokeWidth={3} />
        <text x={GATE.x + 40} y={ROAD_Y - 84} fontSize={9} fontWeight={600} fill={LEVEL_COLOR[nfeLevel]}>
          {snap.nfeMode === "svc" ? "SVC-RS · tpEmis 7" : snap.nfeMode === "cert" ? "cStat 281" : snap.nfeMode === "down" ? `SEFAZ-PR ${snap.sefazStatus.code}` : "SEFAZ-PR 107"}
        </text>
      </g>

      <g ref={truckLayer} />
      <g ref={badgeLayer} />
      {hl && <rect className="ff-hl" x={hl.x - 4} y={hl.y - 4} width={hl.w + 8} height={hl.h + 8} rx={10} />}
    </svg>
  );
};
