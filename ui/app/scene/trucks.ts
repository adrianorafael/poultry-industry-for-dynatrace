import type { Engine } from "../sim/engine";
import type { LiveTruck, Load } from "../sim/types";
import { MARKET_COLOR, STATUS, type ScenePalette } from "../theme/colors";
import {
  bayPos,
  dockPos,
  EXPORT_EXIT_Y,
  FG_SCALE,
  FV_SCALE_IN,
  FV_SCALE_OUT,
  GATE,
  gateQueuePos,
  inQueuePos,
  outQueuePos,
  PLATFORM,
  ROAD_IN_Y,
  ROAD_OUT_Y,
  ROAD_Y,
  yardPos,
  type Pt,
} from "./geometry";

const NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

interface Pose {
  x: number;
  y: number;
  a: number;
}

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/** Position along a polyline at fraction u (0–1), with the heading of the current segment. */
function along(pts: Pt[], u: number): Pose {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push(d);
    total += d;
  }
  let dist = ease(Math.min(1, Math.max(0, u))) * total;
  for (let i = 0; i < seg.length; i++) {
    if (dist <= seg[i] || i === seg.length - 1) {
      const f = seg[i] > 0 ? Math.min(1, dist / seg[i]) : 1;
      const a = pts[i];
      const b = pts[i + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
    }
    dist -= seg[i];
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, a: 0 };
}

const progress = (start: number, end: number, now: number) => (end > start ? (now - start) / (end - start) : 1);
const at = (p: Pt, a: number): Pose => ({ x: p.x, y: p.y, a });

function livePose(t: LiveTruck, now: number, queue: number): Pose | null {
  const u = progress(t.stageStart, t.stageEnd, now);
  switch (t.stage) {
    case "road":
      return along([{ x: -140, y: ROAD_IN_Y }, inQueuePos(queue)], u);
    case "scaleQueue":
      return at(inQueuePos(t.slot), 0);
    case "scaleIn":
      return at(FV_SCALE_IN, 0);
    case "toShed": {
      const b = bayPos(t.bay);
      return along([FV_SCALE_IN, { x: b.x, y: ROAD_IN_Y + (t.bay >= 7 ? 55 : -55) }, b], u);
    }
    case "shed":
      return at(bayPos(t.bay), t.bay >= 7 ? -90 : 90);
    case "toPlatform":
      return along([bayPos(t.bay), { x: PLATFORM.x - 30, y: PLATFORM.y }, PLATFORM], u);
    case "unloading":
      return at(PLATFORM, 90);
    case "toScaleOut":
      return along([PLATFORM, { x: PLATFORM.x, y: ROAD_OUT_Y }, outQueuePos(0)], u);
    case "scaleOut":
      return t.stageEnd > t.stageStart ? at(FV_SCALE_OUT, 180) : at(outQueuePos(t.slot), 180);
    case "leaving":
      return along([FV_SCALE_OUT, { x: -140, y: ROAD_OUT_Y }], u);
    default:
      return null;
  }
}

function loadPose(l: Load, now: number, queue: number): Pose | null {
  const u = progress(l.stageStart, l.stageEnd, now);
  switch (l.stage) {
    case "road":
      return along([{ x: -150, y: ROAD_Y }, gateQueuePos(queue)], u);
    case "tareQueue":
      return at(gateQueuePos(l.slot), 0);
    case "tare":
      return at(FG_SCALE, 0);
    case "yardDock":
    case "yardNfe":
      return at(yardPos(l.slot), -90);
    case "toDock": {
      const d = dockPos(l.dock);
      const y = yardPos(l.slot);
      return along([y, { x: y.x, y: d.y }, { x: d.x - 70, y: d.y }, d], u);
    }
    case "loading":
    case "grossQueue":
      return at(dockPos(l.dock), 180);
    case "toScale": {
      return along([{ x: 780, y: ROAD_Y }, FG_SCALE], u);
    }
    case "gross":
      return at(FG_SCALE, 180);
    case "gate":
      return at(GATE, 180);
    case "leaving":
      return along([GATE, { x: 40, y: l.market === "EXP" ? EXPORT_EXIT_Y : ROAD_Y }, { x: -150, y: l.market === "EXP" ? EXPORT_EXIT_Y : ROAD_Y }], u);
    default:
      return null;
  }
}

interface Sprite {
  g: SVGGElement;
  body: SVGRectElement;
  fill?: SVGRectElement;
  bar?: SVGRectElement;
  badge?: SVGGElement;
  badgeDot?: SVGCircleElement;
  badgeText?: SVGTextElement;
  len: number;
}

export class TruckLayer {
  private sprites = new Map<string, Sprite>();

  constructor(
    private layer: SVGGElement,
    private badges: SVGGElement,
    private onClick: (kind: "truck" | "load", id: string) => void,
  ) {}

  clear(): void {
    for (const s of this.sprites.values()) {
      s.g.remove();
      s.badge?.remove();
    }
    this.sprites.clear();
  }

  private liveSprite(t: LiveTruck, P: ScenePalette): Sprite {
    const g = el("g", { class: "ff-truck", role: "button", "aria-label": `Caminhão de aves ${t.id}` });
    const body = el("rect", { x: -30, y: -9, width: 44, height: 18, rx: 2, fill: P.cage, stroke: "rgba(0,0,0,0.35)", "stroke-width": 0.8 });
    g.appendChild(body);
    const fill = el("rect", { x: -30, y: -9, width: 44, height: 18, rx: 2, fill: "rgba(255,255,255,0.0)" });
    g.appendChild(fill);
    for (let i = 1; i < 6; i++) g.appendChild(el("line", { x1: -30 + i * 7.3, y1: -9, x2: -30 + i * 7.3, y2: 9, stroke: "rgba(0,0,0,0.22)", "stroke-width": 0.8 }));
    g.appendChild(el("rect", { x: 15, y: -8, width: 13, height: 16, rx: 3, fill: P.truckCab, stroke: "rgba(0,0,0,0.35)", "stroke-width": 0.8 }));
    g.appendChild(el("rect", { x: 24, y: -6, width: 3, height: 12, rx: 1, fill: "#5F7385" }));
    g.addEventListener("click", () => this.onClick("truck", t.id));
    this.layer.appendChild(g);
    return { g, body, fill, len: 58 };
  }

  private loadSprite(l: Load, P: ScenePalette): Sprite {
    const len = l.vehicle === "container" ? 62 : l.vehicle === "carreta" ? 58 : l.vehicle === "truck" ? 40 : 28;
    const g = el("g", { class: "ff-truck", role: "button", "aria-label": `Carga ${l.id}` });
    const x0 = -len / 2 - 6;
    const body = el("rect", {
      x: x0,
      y: -9,
      width: len,
      height: 18,
      rx: 2,
      fill: l.vehicle === "container" ? P.container : P.reefer,
      stroke: "rgba(0,0,0,0.35)",
      "stroke-width": 0.8,
    });
    g.appendChild(body);
    g.appendChild(el("rect", { x: x0, y: -9, width: len, height: 4, fill: MARKET_COLOR[l.market] }));
    if (l.vehicle === "container") g.appendChild(el("rect", { x: x0 + len - 7, y: -7, width: 5, height: 14, fill: "#E9EDF1" }));
    g.appendChild(el("rect", { x: len / 2 - 4, y: -8, width: 12, height: 16, rx: 3, fill: P.truckCab, stroke: "rgba(0,0,0,0.35)", "stroke-width": 0.8 }));
    g.appendChild(el("rect", { x: len / 2 + 4, y: -6, width: 3, height: 12, rx: 1, fill: "#5F7385" }));
    const bar = el("rect", { x: x0, y: 11, width: 0, height: 3, rx: 1, fill: STATUS.ok });
    g.appendChild(bar);
    g.addEventListener("click", () => this.onClick("load", l.id));
    this.layer.appendChild(g);
    const badge = el("g", { class: "ff-badge", "pointer-events": "none" });
    const badgeDot = el("circle", { r: 8, cx: 0, cy: 0, fill: STATUS.warning, stroke: "#FFFFFF", "stroke-width": 1.2 });
    const badgeText = el("text", { x: 0, y: 3.5, "text-anchor": "middle", "font-size": 10, "font-weight": 800, fill: "#1B1B1B" });
    badge.appendChild(badgeDot);
    badge.appendChild(badgeText);
    this.badges.appendChild(badge);
    return { g, body, bar, badge, badgeDot, badgeText, len };
  }

  render(engine: Engine, P: ScenePalette): void {
    const now = engine.now();
    const seen = new Set<string>();
    const liveQueue = engine.trucks.filter((t) => t.stage === "scaleQueue").length;
    for (const t of engine.trucks) {
      const pose = livePose(t, now, liveQueue);
      if (!pose) continue;
      const key = `T${t.id}`;
      seen.add(key);
      let s = this.sprites.get(key);
      if (!s) {
        s = this.liveSprite(t, P);
        this.sprites.set(key, s);
      }
      s.g.setAttribute("transform", `translate(${pose.x.toFixed(1)},${pose.y.toFixed(1)}) rotate(${pose.a.toFixed(0)})`);
      const empty = t.birds > 0 ? 1 - t.birdsLeft / t.birds : 0;
      s.fill?.setAttribute("fill", `rgba(255,255,255,${(empty * 0.75).toFixed(2)})`);
      s.body.setAttribute("stroke", t.blocked ? STATUS.critical : "rgba(0,0,0,0.35)");
      s.body.setAttribute("stroke-width", t.blocked ? "2.2" : "0.8");
    }
    const gateQueue = engine.loads.filter((l) => l.stage === "tareQueue").length;
    for (const l of engine.loads) {
      const pose = loadPose(l, now, gateQueue);
      if (!pose) continue;
      const key = `C${l.id}`;
      seen.add(key);
      let s = this.sprites.get(key);
      if (!s) {
        s = this.loadSprite(l, P);
        this.sprites.set(key, s);
      }
      s.g.setAttribute("transform", `translate(${pose.x.toFixed(1)},${pose.y.toFixed(1)}) rotate(${pose.a.toFixed(0)})`);
      const loadingShare = l.stage === "loading" ? l.loadedPallets / l.pallets : 0;
      s.bar?.setAttribute("width", (s.len * loadingShare).toFixed(1));
      s.body.setAttribute("stroke", l.blocked ? STATUS.critical : "rgba(0,0,0,0.35)");
      s.body.setAttribute("stroke-width", l.blocked ? "2.2" : "0.8");
      this.renderBadge(s, l, pose);
    }
    for (const [key, s] of this.sprites) {
      if (seen.has(key)) continue;
      s.g.remove();
      s.badge?.remove();
      this.sprites.delete(key);
    }
  }

  /** NF-e badge over loaded trucks: ⌛ waiting, ✕ blocked, ✓ authorized. */
  private renderBadge(s: Sprite, l: Load, pose: Pose): void {
    if (!s.badge || !s.badgeDot || !s.badgeText) return;
    const show = l.t.gross !== undefined && l.stage !== "leaving";
    s.badge.setAttribute("visibility", show ? "visible" : "hidden");
    if (!show) return;
    let fill: string = STATUS.warning;
    let text = "…";
    let fg = "#1B1B1B";
    const rejected = l.nfes.some((n) => n.state === "rejected" || n.state === "retry");
    if (l.nfeState === "done" || l.nfeState === "danfe") {
      fill = STATUS.ok;
      text = "✓";
      fg = "#FFFFFF";
    } else if (rejected || l.nfeState === "ticket" || l.nfeState === "manual") {
      fill = STATUS.critical;
      text = "!";
      fg = "#FFFFFF";
    }
    s.badgeDot.setAttribute("fill", fill);
    s.badgeText.setAttribute("fill", fg);
    s.badgeText.textContent = text;
    s.badge.setAttribute("transform", `translate(${pose.x.toFixed(1)},${(pose.y - (Math.abs(pose.a) === 90 ? 40 : 20)).toFixed(1)})`);
  }
}
