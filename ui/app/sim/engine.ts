import { levelFor, worst, type Level } from "../theme/colors";
import { fmtBrl, fmtDec, fmtInt, fmtPct, fmtT } from "../format";
import {
  ANTE_CAPACITY,
  APPOINTMENT_WAIT_MIN,
  BIRDS_PER_TRUCK,
  BOX_KG,
  BOXES_PER_PALLET,
  BRL_PER_USD,
  CARCASS_GROSS,
  CERT_DAYS,
  CONTAM_BASE,
  COUNTRIES,
  CUSTOMER_KINDS,
  DANFE_MIN,
  dispatchWeight,
  DOA_SHED_PER_H,
  DOA_TRANSPORT,
  DISPATCH_WEIGHT_SUM,
  DOCKS,
  DOMESTIC_PRODUCTS,
  DOMESTIC_VEHICLES,
  ERP_INVOICE_MIN,
  EXPORT_SHARE,
  FG_SCALE_MIN,
  GATE_MIN,
  GIBLETS,
  holidayName,
  LINE_NOMINAL,
  LINE_SIF_REDUCED,
  LINES,
  LIVE_KG_MEAN,
  LIVE_BRL_KG,
  LOADS_PER_DAY,
  MICROSTOP_EVERY_MIN,
  MICROSTOP_MIN,
  NFE_FIRST_NUMBER,
  NFE_MEDIAN_S,
  NFE_SIGMA,
  EXTRA_SHIFT_BIRDS,
  EXTRA_SHIFT_H,
  HISTORY_OVERTIME_H,
  PARTIAL_BASE,
  PARTIAL_CAUSES,
  PAWS,
  PLAN_BIRDS_DAY,
  PLAN_FIN_PER_BIRD,
  PLAN_LOSS_CAUSES,
  PLAN_MAJOR_CAUSES,
  PLAN_RATE,
  PLATFORM_BUFFER,
  PORT_HOURS,
  PROCESS_DELAY_MIN,
  PROCESS_LOSS,
  PRODUCT_BY_ID,
  PRODUCTS,
  PUTAWAY_RATE,
  RECEIVING,
  PCP_DEFAULTS,
  PREFER_EXTRA_DAY_H,
  PROD_DAY_END_H,
  SCALE_IN_MIN,
  SCALE_OUT_MIN,
  SHED_BAYS,
  SHED_TARGET,
  SHED_TEMP_NORMAL,
  SHIFTS,
  SHRINK_PER_H,
  STORAGE_PALLETS,
  STORAGE_PRACTICAL_MAX,
  STORAGE_SETPOINT,
  STORAGE_TARGET,
  SVC_ACTIVATION_MIN,
  SVC_MEDIAN_S,
  TOTAL_BASE,
  TOTAL_CAUSES,
  TRIM_SHARE,
  TRUCK_TARE_KG,
  TUNNEL_CAPACITY,
  TUNNEL_MAX_LOAD_TEMP,
  TUNNEL_SETPOINT,
  TUNNELS,
  tunnelDwellH,
  UFS,
  UNLOAD_RATE,
  VEHICLES,
  YARD_SLOTS,
  type ProductId,
  type Vehicle,
} from "./model";
import { hash01, Rng } from "./rng";
import { CERT_FORECAST, SCENARIO_BY_ID, SCENARIOS, type ScenarioDef, type ScenarioId } from "./scenarios";
import { clockParts, fmtClock, fmtDate, fmtDuration, fmtH, fmtHour, prodParts, type ProdParts } from "./time";
import type {
  BayView,
  DockView,
  EngineEvents,
  ExpeditionView,
  HourlyPoint,
  KpiSet,
  LineView,
  LiveTruck,
  Load,
  LoadRow,
  MassBalance,
  Nfe,
  NfeView,
  PcpConfig,
  PcpDayKind,
  PcpDayView,
  PcpRecovery,
  PcpView,
  ProblemView,
  SessionStats,
  Snapshot,
  SparkKey,
  StageId,
  StageView,
  TunnelView,
  Weighing,
} from "./types";

// ---------------------------------------------------------------- clock
const STEP_MS = 1000;
const COARSE_MS = 15_000;
const WARMUP_H = 30;
const SPARK_EVERY_MS = 10 * 60_000;
const SPARK_LEN = 36;
const MIN = 60_000;
const HOUR = 3600_000;
export const DEFAULT_SEED = 20260930;
export const DEFAULT_SPEED = 60;
export const SPEEDS = [1, 10, 60] as const;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const pad = (n: number, w: number) => String(n).padStart(w, "0");
/** Loss metrics are never shown as "good": below the warning threshold they are neutral. */
const lossLevel = (l: Level): Level => (l === "ok" ? "neutral" : l);

type Handler<K extends keyof EngineEvents> = (e: EngineEvents[K]) => void;

interface Tunnel {
  temp: number;
  bins: { boxes: number; progress: number; idx: number }[];
  ready: number;
  blocked: boolean;
}

interface LineState {
  rate: number;
  microUntil: number;
  contam: number;
  sif: boolean;
}

interface RunCounters {
  extraDoa: number;
  lostBirds: number;
  extraCond: number;
  heldPeak: number;
  heldKgPeak: number;
  heldBrlPeak: number;
  rejected: number;
  svc: number;
  manual: number;
  riskPeak: number;
  notTaken: number;
  minYield: number;
}

interface Run {
  def: ScenarioDef;
  phase: "active" | "recovering";
  startedSim: number;
  elapsedMin: number;
  recMin: number;
  k: number;
  opened: boolean;
  c: RunCounters;
}

interface Resolved {
  def: ScenarioDef;
  startedSim: number;
  durMin: number;
  c: RunCounters;
}

/** One production day (03:00 to 03:00). */
interface Day {
  /** Local midnight of the production date. */
  date: number;
  /** Instant the production day starts. */
  start: number;
  birds: number;
  liveKg: number;
  carcassKg: number;
  pawsKg: number;
  gibletsKg: number;
  trimKg: number;
  condKg: number;
  doa: number;
  doaKg: number;
  partial: number;
  total: number;
  causesP: Record<string, number>;
  causesT: Record<string, number>;
  boxes: number;
  finishedKg: number;
  produced: Record<string, number>;
  shippedKg: number;
  loads: number;
  loadsExp: number;
  loadsMi: number;
  exportKg: number;
  exportUsd: number;
  domesticKg: number;
  domesticBrl: number;
  byCountry: Record<string, { kg: number; usd: number }>;
  byUf: Record<string, { kg: number; brl: number }>;
  byProduct: Record<string, number>;
  nfeAuth: number;
  nfeRej: number;
  nfeSvc: number;
  missedCutoff: number;
}

/** Exponentially decaying sum (time constant tau, in ms). */
class Decay {
  v = 0;
  constructor(private tau: number) {}
  add(x: number, dtMs: number): void {
    this.v = this.v * Math.exp(-dtMs / this.tau) + x;
  }
}

function newDay(p: ProdParts): Day {
  return {
    date: p.date,
    start: p.start,
    birds: 0,
    liveKg: 0,
    carcassKg: 0,
    pawsKg: 0,
    gibletsKg: 0,
    trimKg: 0,
    condKg: 0,
    doa: 0,
    doaKg: 0,
    partial: 0,
    total: 0,
    causesP: {},
    causesT: {},
    boxes: 0,
    finishedKg: 0,
    produced: {},
    shippedKg: 0,
    loads: 0,
    loadsExp: 0,
    loadsMi: 0,
    exportKg: 0,
    exportUsd: 0,
    domesticKg: 0,
    domesticBrl: 0,
    byCountry: {},
    byUf: {},
    byProduct: {},
    nfeAuth: 0,
    nfeRej: 0,
    nfeSvc: 0,
    missedCutoff: 0,
  };
}

function newCounters(): RunCounters {
  return {
    extraDoa: 0,
    lostBirds: 0,
    extraCond: 0,
    heldPeak: 0,
    heldKgPeak: 0,
    heldBrlPeak: 0,
    rejected: 0,
    svc: 0,
    manual: 0,
    riskPeak: 0,
    notTaken: 0,
    minYield: 100,
  };
}

/** A day of the PCP calendar. */
interface PcpDay {
  date: number;
  dom: number;
  dow: number;
  kind: PcpDayKind;
  holiday?: string;
  planBirds: number;
  planKg: number;
  extraDay: boolean;
  /** Extra day planned as a single shift (Saturday scheduled by the PCP). */
  oneShift: boolean;
  extraPlanBirds: number;
  extraPlanKg: number;
  extraH: number;
  actualBirds: number | null;
  actualKg: number | null;
  cause?: string;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const quarterUp = (h: number) => Math.ceil(h * 4 - 1e-6) / 4;
/** Lost birds in plan terms: slaughter hours the PCP needs to recover them. */
const planNote = (birds: number): string | undefined => (birds >= 0.05 * PLAN_RATE ? `≈ ${fmtH(birds / PLAN_RATE)} de abate no plano` : undefined);
/**
 * Today's status against the plan to now: a micro-stop early in the shift is noise, so the bands
 * are the larger of a share of the plan and a slice of slaughter time (15 / 30 min).
 */
const todayLevel = (delta: number, planToNow: number, shown: boolean): Level => {
  if (!shown) return "neutral";
  if (delta >= -Math.max(0.02 * planToNow, 0.25 * PLAN_RATE)) return "ok";
  if (delta >= -Math.max(0.05 * planToNow, 0.5 * PLAN_RATE)) return "warning";
  return "critical";
};
const adherenceLevel = (pct: number | null): Level => (pct === null ? "neutral" : pct >= 98 ? "ok" : pct >= 95 ? "warning" : "critical");

const LOADED_STAGES = new Set(["grossQueue", "toScale", "gross", "yardNfe"]);
/** Finished product per live kg hung, at baseline quality. */
const FIN_PER_LIVE = (CARCASS_GROSS * (1 - PARTIAL_BASE * TRIM_SHARE) + PAWS + GIBLETS) * (1 - PROCESS_LOSS) * (1 - TOTAL_BASE);
/** Boxes per hour packed with both lines at nominal speed. */
const NOMINAL_BOXES_H = (LINE_NOMINAL * LINES * 0.97 * LIVE_KG_MEAN * FIN_PER_LIVE) / BOX_KG;

export class Engine {
  seed = DEFAULT_SEED;
  simTime = Date.now();
  speed: number = DEFAULT_SPEED;
  paused = false;

  /** Live-bird trucks at or near the plant (read by the scene every frame). */
  trucks: LiveTruck[] = [];
  /** Expedition loads at or near the plant (read by the scene every frame). */
  loads: Load[] = [];
  tunnels: Tunnel[] = [];
  lines: LineState[] = [];
  platformBirds = 0;
  ante = 0;

  private rng = new Rng(DEFAULT_SEED);
  private warming = false;
  private acc = 0;
  private realNow = 0;
  private truckSeq = 0;
  private loadSeq = 0;
  private truckAcc = 0;
  private truckNext = 1;
  private loadAcc = 0;
  private loadNext = 1;
  private nfeSeq = NFE_FIRST_NUMBER;
  private protoSeq = 400000;
  private bays: (string | null)[] = [];
  private yardSlots: (string | null)[] = [];
  private docks: (string | null)[] = [];
  private fvIn: LiveTruck | null = null;
  private fvOut: LiveTruck | null = null;
  private unloader: LiveTruck | null = null;
  private fgScale: Load | null = null;
  private manualBusy: Load | null = null;
  private manualUntil = 0;
  private platformKg = LIVE_KG_MEAN;
  private downFactor = 1;
  /** Line rate smoothed over ~10 plant minutes for KPIs (micro-stops stay visible in the scene). */
  private lineSmooth = 0;
  private wasSlaughtering = false;
  private pipeline = new Map<number, number>();
  private storage: Record<string, number> = {};
  private storageTemp = STORAGE_SETPOINT;
  private shedTemp = SHED_TEMP_NORMAL;
  private nfes: Nfe[] = [];
  private nfeLat: { t: number; s: number }[] = [];
  private recentTrucks: LiveTruck[] = [];
  private recentLoads: Load[] = [];
  private weighings: Weighing[] = [];
  private nfeFeed: Nfe[] = [];
  private day!: Day;
  private hourly: HourlyPoint[] = [];
  private certRenewed = false;
  /** PCP calendar of the current month. */
  private pcpDays: PcpDay[] = [];
  private pcpMonth = -1;
  /** First production day whose actuals come from the simulation (earlier days are history). */
  private pcpAnchor = 0;
  private pcpPrev!: PcpView["previous"];
  /** PCP day of the running production day (undefined while warming up before the anchor). */
  private pcpCur: PcpDay | undefined;
  private snapPcp: PcpView | undefined;
  private pcpConfig: PcpConfig = { ...PCP_DEFAULTS };
  /** The production day closed last (late boxes from overtime past ~01:30 still land in it). */
  private prevDay: Day | undefined;
  private anteRate = 0;
  /** Chilled product held back (câmara de resfriados) when the antecâmara is full. */
  private chilledHold = 0;
  private outRate = 20;
  private tunnelInRate = 0;
  private putawayRate = 0;
  private outStep = 0;
  private lastAnte = 0;
  private packRate = 0;
  private yieldCarc = new Decay(40 * MIN);
  private yieldLive = new Decay(40 * MIN);
  private lossDead = new Decay(60 * MIN);
  private lossBirds = new Decay(60 * MIN);
  private partialSum = new Decay(60 * MIN);
  private doaDead = new Decay(60 * MIN);
  private runs = new Map<ScenarioId, Run>();
  private resolved: Resolved[] = [];
  private session!: SessionStats;
  private spark!: Record<SparkKey, number[]>;
  private lastSpark = 0;
  private highlightId: string | null = null;
  private highlightUntil = 0;
  private listeners: { [K in keyof EngineEvents]: Set<Handler<K>> } = {
    weighed: new Set(),
    nfeSent: new Set(),
    nfeResult: new Set(),
    shipped: new Set(),
  };
  private snap!: Snapshot;
  private version = 0;
  private lastSnapReal = -1e9;
  private snapListeners = new Set<() => void>();

  constructor(seed = DEFAULT_SEED) {
    this.reset(seed);
  }

  // ------------------------------------------------------------ public API
  reset(seed = this.seed): void {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.runs.clear();
    this.resolved = [];
    this.certRenewed = false;
    this.jumpTo(Date.now());
    this.forceSnapshot();
  }

  on<K extends keyof EngineEvents>(evt: K, fn: Handler<K>): () => void {
    this.listeners[evt].add(fn);
    return () => this.listeners[evt].delete(fn);
  }

  subscribe = (fn: () => void): (() => void) => {
    this.snapListeners.add(fn);
    return () => this.snapListeners.delete(fn);
  };

  getSnapshot = (): Snapshot => this.snap;

  setSpeed(s: number): void {
    this.speed = s;
    this.forceSnapshot();
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.forceSnapshot();
  }

  /** Simulated hour (0–24), or null for "now" (real local time). */
  setHour(h: number | null): void {
    if (h === null) this.jumpTo(Date.now());
    else this.jumpTo(clockParts(this.simTime).dayStart + h * HOUR);
    this.forceSnapshot();
  }

  /** Pins the plant clock to an absolute instant (tests and rehearsals). */
  setSimTime(ms: number): void {
    this.jumpTo(ms);
    this.forceSnapshot();
  }

  toggleScenario(id: ScenarioId): void {
    const run = this.runs.get(id);
    if (!run) this.startRun(id);
    else if (run.phase === "active") this.endRun(run);
    this.forceSnapshot();
  }

  /** Ends every active incident (key 0). */
  normalize(): void {
    for (const run of this.runs.values()) if (run.phase === "active") this.endRun(run);
    this.forceSnapshot();
  }

  /** PCP settings (overtime limit, extra-day shifts). Labor rules are HR's: the plan accepts what is set here. */
  setPcpConfig(c: Partial<PcpConfig>): void {
    this.pcpConfig = { ...this.pcpConfig, ...c };
    // a lower limit trims today's approved overtime (never below what already ran)
    if (this.pcpCur) this.approveOvertime(this.pcpCur.extraH);
    else this.forceSnapshot();
  }

  /** Approves overtime for today's slaughter (hours, quarter-hour steps, up to the configured limit). */
  approveOvertime(h: number): void {
    const d = this.pcpCur;
    if (!d) return;
    const end = this.regularEnd(d);
    const ph = prodParts(this.simTime).hour;
    const used = clamp(ph - end, 0, d.extraH);
    d.extraH = clamp(Math.max(used, Math.round(h * 4) / 4), 0, Math.max(used, this.overtimeCap(d)));
    this.forceSnapshot();
  }

  /** Schedules (or cancels) an extra slaughter day on a future Saturday, Sunday or holiday of the month. */
  toggleExtraDay(date: number): void {
    const d = this.pcpDays.find((x) => x.date === date);
    if (!d || d.kind === "util" || d.date <= this.day.date) return;
    const shifts = this.pcpConfig.extraDayShifts;
    d.extraDay = !d.extraDay;
    d.oneShift = d.extraDay && shifts === 1;
    d.extraPlanBirds = d.extraDay ? this.extraDayBirds(shifts) : 0;
    d.extraPlanKg = d.extraDay ? Math.round((d.extraPlanBirds * PLAN_FIN_PER_BIRD) / 100) * 100 : 0;
    this.forceSnapshot();
  }

  highlight(id: string): void {
    this.highlightId = id;
    this.highlightUntil = this.realNow + 6000;
    this.forceSnapshot();
  }

  getHighlight(): string | null {
    return this.realNow < this.highlightUntil ? this.highlightId : null;
  }

  getTruck(id: string): LiveTruck | undefined {
    return this.trucks.find((t) => t.id === id) ?? this.recentTrucks.find((t) => t.id === id);
  }

  getLoad(id: string): Load | undefined {
    return this.loads.find((l) => l.id === id) ?? this.recentLoads.find((l) => l.id === id);
  }

  scenarioK(id: ScenarioId): number {
    return this.runs.get(id)?.k ?? 0;
  }

  isActive(id: ScenarioId): boolean {
    return this.runs.get(id)?.phase === "active";
  }

  /** Plant time including the fraction not yet stepped (smooth motion at 1×). */
  now(): number {
    return this.simTime + Math.min(this.acc, STEP_MS);
  }

  // ------------------------------------------------------------ main loop
  tick(now: number): void {
    const gap = this.realNow === 0 ? 16 : now - this.realNow;
    this.realNow = now;
    if (!this.paused) {
      if (gap > 1500) {
        // hidden tab: catch up in coarse steps, without effects
        const target = this.simTime + gap * this.speed;
        if (target - this.simTime > WARMUP_H * HOUR) this.jumpTo(target);
        else {
          this.warming = true;
          while (this.simTime < target) this.step(Math.min(COARSE_MS, target - this.simTime));
          this.warming = false;
        }
        this.acc = 0;
      } else {
        this.acc += gap * this.speed;
        let steps = 0;
        while (this.acc >= STEP_MS && steps < 400) {
          this.step(STEP_MS);
          this.acc -= STEP_MS;
          steps++;
        }
        if (steps >= 400) this.acc = 0;
      }
    }
    if (now - this.lastSnapReal >= 250) this.forceSnapshot();
  }

  // ------------------------------------------------------------ state
  private jumpTo(ms: number): void {
    this.runs.clear();
    this.rng = new Rng(this.seed);
    this.initState(ms - WARMUP_H * HOUR);
    this.pcpAnchor = prodParts(ms).date;
    this.buildPcp(this.pcpAnchor);
    this.warming = true;
    while (this.simTime < ms) this.step(Math.min(COARSE_MS, ms - this.simTime));
    this.warming = false;
    this.acc = 0;
    this.session = { birds: 0, finishedKg: 0, shippedKg: 0, nfes: 0, incidents: [], start: Date.now() };
    this.spark = { health: [], birds: [], line: [], yield: [], condemn: [], storage: [], finished: [], shipped: [], nfe: [] };
    this.lastSpark = 0;
  }

  private initState(t0: number): void {
    this.simTime = t0;
    this.trucks = [];
    this.loads = [];
    this.recentTrucks = [];
    this.recentLoads = [];
    this.weighings = [];
    this.nfeFeed = [];
    this.nfes = [];
    this.nfeLat = [];
    this.bays = new Array<string | null>(SHED_BAYS).fill(null);
    this.yardSlots = new Array<string | null>(YARD_SLOTS).fill(null);
    this.docks = new Array<string | null>(DOCKS).fill(null);
    this.fvIn = null;
    this.fvOut = null;
    this.unloader = null;
    this.fgScale = null;
    this.manualBusy = null;
    this.platformBirds = 0;
    this.platformKg = LIVE_KG_MEAN;
    this.downFactor = 1;
    this.ante = 200;
    this.chilledHold = 0;
    this.chilledHold = 0;
    this.lastAnte = 200;
    this.anteRate = 0;
    this.packRate = 0;
    this.pipeline.clear();
    this.lines = Array.from({ length: LINES }, () => ({ rate: 0, microUntil: 0, contam: CONTAM_BASE, sif: false }));
    this.shedTemp = SHED_TEMP_NORMAL;
    this.storageTemp = STORAGE_SETPOINT;
    this.storage = {};
    for (const p of PRODUCTS) this.storage[p.id] = STORAGE_PALLETS * STORAGE_TARGET * p.mix;
    // Tunnels seeded with an average day's work in progress.
    const avgBoxesH = 1350;
    this.tunnels = Array.from({ length: TUNNELS }, () => ({ temp: TUNNEL_SETPOINT, bins: [], ready: 0, blocked: false }));
    for (let i = 0; i < 108; i++) {
      for (const tn of this.tunnels) tn.bins.push({ boxes: (avgBoxesH / 6 / TUNNELS) * 0.9, progress: 1 - i / 108, idx: -1 });
    }
    this.yieldCarc = new Decay(40 * MIN);
    this.yieldLive = new Decay(40 * MIN);
    this.lossDead = new Decay(60 * MIN);
    this.lossBirds = new Decay(60 * MIN);
    this.partialSum = new Decay(60 * MIN);
    this.doaDead = new Decay(60 * MIN);
    // Seed the quality windows with the baseline so KPIs start stable.
    this.yieldLive.v = 1000;
    this.yieldCarc.v = 1000 * CARCASS_GROSS * (1 - PARTIAL_BASE * TRIM_SHARE);
    this.lossBirds.v = 100000;
    this.lossDead.v = 100000 * (DOA_TRANSPORT + DOA_SHED_PER_H * 1.2 + TOTAL_BASE);
    this.partialSum.v = 100000 * PARTIAL_BASE;
    this.doaDead.v = 100000 * (DOA_TRANSPORT + DOA_SHED_PER_H * 1.2);
    this.day = newDay(prodParts(t0));
    this.prevDay = undefined;
    this.hourly = [];
    this.truckSeq = 0;
    this.loadSeq = 0;
    this.truckAcc = 0;
    this.loadAcc = 0;
    this.truckNext = this.gamma4();
    this.loadNext = this.gamma4();
  }

  /** Inter-arrival in "expected arrivals" (Erlang-4 / 4: mean 1, lower variance than Poisson). */
  private gamma4(): number {
    let s = 0;
    for (let i = 0; i < 4; i++) s += this.rng.expo(1);
    return s / 4;
  }

  // ------------------------------------------------------------ step
  private step(dtMs: number): void {
    this.simTime += dtMs;
    const { hour } = clockParts(this.simTime);
    const prod = prodParts(this.simTime);
    if (prod.date !== this.day.date) this.newDay(prod);
    // slaughter logic runs on the production-day hour (3–27), expedition on the clock hour
    const ph = prod.hour;
    this.trackHour();
    this.advanceRuns(dtMs);
    this.stepEnvironment(dtMs);
    this.stepLiveArrivals(dtMs, ph);
    this.stepTrucks(dtMs);
    this.stepLines(dtMs, ph);
    this.stepPipeline(dtMs);
    this.stepTunnels(dtMs);
    this.stepLoadArrivals(dtMs, hour);
    this.stepLoads(dtMs);
    this.stepNfe();
    this.trackRuns();
    if (!this.warming && this.simTime - this.lastSpark >= SPARK_EVERY_MS) this.recordSpark();
  }

  private newDay(p: ProdParts): void {
    this.closePcpDay(this.day);
    this.prevDay = this.day;
    this.day = newDay(p);
    this.truckSeq = 0;
    this.loadSeq = 0;
    this.openPcpDay();
  }

  private trackHour(): void {
    const start = Math.floor(this.simTime / HOUR) * HOUR;
    const last = this.hourly[this.hourly.length - 1];
    if (!last || last.start !== start) {
      this.hourly.push({ start, producedKg: 0, shippedKg: 0, storagePct: this.storagePct(), birds: 0 });
      if (this.hourly.length > 25) this.hourly.shift();
    }
  }

  private get hourNow(): HourlyPoint {
    return this.hourly[this.hourly.length - 1];
  }

  private emit<K extends keyof EngineEvents>(evt: K, e: EngineEvents[K]): void {
    if (this.warming) return;
    for (const fn of this.listeners[evt]) fn(e);
  }

  // ------------------------------------------------------------ environment and scenario effects
  private stepEnvironment(dtMs: number): void {
    const heat = this.scenarioK("heat");
    const target = SHED_TEMP_NORMAL + 7.6 * heat;
    this.shedTemp += (target - this.shedTemp) * Math.min(1, dtMs / (8 * MIN));

    const evisc = this.scenarioK("evisc");
    const run = this.runs.get("evisc");
    this.lines.forEach((ln, i) => {
      ln.contam = i === 1 ? CONTAM_BASE + (0.07 - CONTAM_BASE) * evisc : CONTAM_BASE;
      if (i === 1) {
        if (run?.phase === "active" && run.elapsedMin >= 12) ln.sif = true;
        else if (ln.sif && ln.contam < 0.02) ln.sif = false;
      } else ln.sif = false;
    });

    const tk = this.scenarioK("tunnel");
    this.tunnels.forEach((tn, i) => {
      // Without C-3 the −40 °C suction loses capacity: T2 is isolated, T1 and T3 run warmer.
      const tgt = TUNNEL_SETPOINT + (i === 1 ? 15 : 4) * tk;
      tn.temp += (tgt - tn.temp) * Math.min(1, dtMs / (12 * MIN));
    });

    let loading = 0;
    for (const id of this.docks) if (id) loading++;
    const occ = this.storagePct() / 100;
    const tgtStore = STORAGE_SETPOINT + loading * 0.12 + Math.max(0, occ - 0.95) * 20;
    this.storageTemp += (tgtStore - this.storageTemp) * Math.min(1, dtMs / (15 * MIN));
  }

  private get sefazDown(): boolean {
    return this.isActive("sefaz");
  }

  private get svcActive(): boolean {
    const r = this.runs.get("sefaz");
    return !!r && r.phase === "active" && r.elapsedMin >= SVC_ACTIVATION_MIN;
  }

  private get certExpired(): boolean {
    return this.isActive("cert");
  }

  private get ticketsDown(): boolean {
    return this.isActive("fgscale");
  }

  private get manualMode(): boolean {
    const r = this.runs.get("fgscale");
    return !!r && r.phase === "active" && r.elapsedMin >= 30;
  }

  private doaFactor(): number {
    return 1 + Math.max(0, this.shedTemp - 28) * 3.5;
  }

  // ------------------------------------------------------------ live birds
  private stepLiveArrivals(dtMs: number, hour: number): void {
    // receiving closes ~50 min before the last slaughter window ends (later with overtime)
    const windows = this.windows();
    const lastEnd = windows[windows.length - 1][1];
    if (hour < RECEIVING[0] || hour >= lastEnd - (SHIFTS[1][1] - RECEIVING[1])) return;
    const effRate = LINE_NOMINAL * LINES * 0.97;
    const atPlant = this.trucks.filter((t) => t.stage !== "leaving" && t.stage !== "toScaleOut" && t.stage !== "scaleOut" && t.stage !== "gone");
    const inventory = this.platformBirds + atPlant.reduce((s, t) => s + (t.birdsLeft - t.doa), 0);
    const first = windows[0][0];
    const remaining = this.slaughterHoursLeft(hour) * effRate + (hour < first ? effRate * 0.3 : 0);
    if (inventory >= remaining) return;
    const stock = atPlant.filter((t) => t.stage !== "unloading" && t.stage !== "toPlatform").length;
    let rate: number;
    if (hour < first) rate = 3.4;
    else {
      const next = this.slaughtering(hour) || this.slaughtering(hour + 0.7) ? effRate : 0;
      rate = next / BIRDS_PER_TRUCK;
    }
    rate *= clamp(1 + (0.45 * (SHED_TARGET - stock)) / SHED_TARGET, 0.15, 2.4);
    this.truckAcc += (rate * dtMs) / HOUR;
    if (this.truckAcc >= this.truckNext) {
      this.truckAcc -= this.truckNext;
      this.truckNext = this.gamma4();
      this.spawnTruck();
    }
  }

  private spawnTruck(): void {
    const n = ++this.truckSeq;
    const heat = this.scenarioK("heat");
    const birds = Math.round(BIRDS_PER_TRUCK + this.rng.normal() * 140);
    const km = Math.round(this.rng.range(12, 95));
    const kg = clamp(LIVE_KG_MEAN + this.rng.normal() * 0.11, 2.45, 3.25);
    const doa = birds * DOA_TRANSPORT * (0.7 + this.rng.next() * 0.6) * (1 + 1.6 * heat);
    const t: LiveTruck = {
      id: `FV-${pad(n, 3)}`,
      n,
      farm: `Integrado ${this.rng.int(101, 489)}`,
      km,
      gta: `${this.rng.int(10, 99)}.${pad(this.rng.int(0, 999999), 6)}`,
      birds,
      birdsLeft: birds,
      doa,
      kgPerBird: kg,
      tareKg: TRUCK_TARE_KG + this.rng.normal() * 380,
      stage: "road",
      stageStart: this.simTime,
      stageEnd: this.simTime + 4 * MIN,
      bay: -1,
      slot: 0,
      blocked: false,
      t: { loaded: this.simTime - (km / 45) * HOUR - 20 * MIN, arrive: this.simTime + 4 * MIN },
    };
    this.trucks.push(t);
    this.runCount((c) => (c.extraDoa += (doa * 1.6 * heat) / (1 + 1.6 * heat)), "heat");
  }

  private setTruck(t: LiveTruck, stage: LiveTruck["stage"], durMin = 0): void {
    t.stage = stage;
    t.stageStart = this.simTime;
    t.stageEnd = this.simTime + durMin * MIN;
  }

  private stepTrucks(dtMs: number): void {
    const now = this.simTime;
    const dtH = dtMs / HOUR;
    const f = this.doaFactor();
    let q = 0;
    let outQ = 0;
    for (const t of this.trucks) {
      switch (t.stage) {
        case "road":
          if (now >= t.stageEnd) this.setTruck(t, "scaleQueue");
          break;
        case "scaleQueue":
          t.slot = q++;
          if (!this.fvIn && t.slot === 0) {
            this.fvIn = t;
            this.setTruck(t, "scaleIn", SCALE_IN_MIN);
            q--;
          }
          break;
        case "scaleIn":
          if (now >= t.stageEnd && t.grossKg === undefined) {
            t.grossKg = Math.round(t.tareKg + t.birds * t.kgPerBird);
            t.t.scaleIn = now;
            this.pushWeighing({ id: `${t.id}-b`, truckId: t.id, farm: t.farm, kind: "bruto", t: now, birds: t.birds, grossKg: t.grossKg });
          }
          if (now >= t.stageEnd) {
            const bay = this.bays.indexOf(null);
            if (bay >= 0) {
              this.bays[bay] = t.id;
              t.bay = bay;
              t.blocked = false;
              this.fvIn = null;
              this.setTruck(t, "toShed", 1.5);
            } else t.blocked = true;
          }
          break;
        case "toShed":
          if (now >= t.stageEnd) {
            this.setTruck(t, "shed");
            t.t.shedIn = now;
          }
          break;
        case "shed": {
          const alive = t.birdsLeft - t.doa;
          const dead = alive * DOA_SHED_PER_H * f * dtH;
          t.doa += dead;
          t.kgPerBird *= 1 - SHRINK_PER_H * (this.shedTemp > 30 ? 1.8 : 1) * dtH;
          this.runCount((c) => (c.extraDoa += (dead * (f - 1)) / f), "heat");
          break;
        }
        case "toPlatform":
          if (now >= t.stageEnd) {
            this.setTruck(t, "unloading");
            t.t.unloadStart = now;
          }
          break;
        case "unloading": {
          const space = PLATFORM_BUFFER - this.platformBirds;
          const move = Math.min(t.birdsLeft, UNLOAD_RATE * dtH, Math.max(0, space));
          if (move > 0) {
            const deadShare = t.birdsLeft > 0 ? t.doa / t.birdsLeft : 0;
            const dead = move * deadShare;
            const alive = move - dead;
            this.platformKg = (this.platformKg * this.platformBirds + t.kgPerBird * alive) / Math.max(1, this.platformBirds + alive);
            this.platformBirds += alive;
            t.birdsLeft -= move;
            t.doa -= dead;
            this.day.doa += dead;
            this.day.doaKg += dead * t.kgPerBird;
            this.lossDead.add(dead, 0);
            this.doaDead.add(dead, 0);
            this.lossBirds.add(move, 0);
          }
          if (t.birdsLeft <= 0.5) {
            t.birdsLeft = 0;
            t.t.unloadEnd = now;
            this.unloader = null;
            this.setTruck(t, "toScaleOut", 1.5);
          }
          break;
        }
        case "toScaleOut":
          if (now >= t.stageEnd) this.setTruck(t, "scaleOut");
          break;
        case "scaleOut":
          if (this.fvOut === t) {
            if (now >= t.stageEnd) {
              t.tareMeasuredKg = Math.round(t.tareKg + this.rng.normal() * 15);
              t.netKg = (t.grossKg ?? 0) - t.tareMeasuredKg;
              t.t.scaleOut = now;
              const deadTotal = Math.round(this.truckDoa.get(t.id) ?? 0);
              this.truckDoa.delete(t.id);
              this.pushWeighing({
                id: `${t.id}-t`,
                truckId: t.id,
                farm: t.farm,
                kind: "tara",
                t: now,
                birds: t.birds,
                grossKg: t.grossKg ?? 0,
                tareKg: t.tareMeasuredKg,
                netKg: t.netKg,
                kgPerBird: t.netKg / t.birds,
                waitMin: t.t.shedIn && t.t.unloadStart ? (t.t.unloadStart - t.t.shedIn) / MIN : 0,
                doa: deadTotal,
              });
              this.fvOut = null;
              this.setTruck(t, "leaving", 3);
            }
          } else {
            t.slot = outQ++;
            if (!this.fvOut && t.slot === 0) {
              this.fvOut = t;
              this.setTruck(t, "scaleOut", SCALE_OUT_MIN);
            }
          }
          break;
        case "leaving":
          if (now >= t.stageEnd) {
            t.stage = "gone";
            t.t.exit = now;
          }
          break;
        default:
          break;
      }
    }
    // Next truck to the hanging platform: the one waiting longest.
    if (!this.unloader && this.platformBirds < PLATFORM_BUFFER * 0.7) {
      let pick: LiveTruck | null = null;
      for (const t of this.trucks) if (t.stage === "shed" && (!pick || (t.t.shedIn ?? 0) < (pick.t.shedIn ?? 0))) pick = t;
      if (pick) {
        this.bays[pick.bay] = null;
        this.truckDoa.set(pick.id, pick.doa);
        this.unloader = pick;
        this.setTruck(pick, "toPlatform", 1.5);
      }
    }
    const gone = this.trucks.filter((t) => t.stage === "gone");
    if (gone.length) {
      this.trucks = this.trucks.filter((t) => t.stage !== "gone");
      this.recentTrucks.push(...gone);
      if (this.recentTrucks.length > 80) this.recentTrucks.splice(0, this.recentTrucks.length - 80);
    }
  }

  /** Dead birds per truck when it leaves the shed (for the tare ticket). */
  private truckDoa = new Map<string, number>();

  private pushWeighing(w: Weighing): void {
    this.weighings.unshift(w);
    if (this.weighings.length > 12) this.weighings.pop();
    this.emit("weighed", w);
  }

  // ------------------------------------------------------------ slaughter lines
  private stepLines(dtMs: number, hour: number): void {
    const dtH = dtMs / HOUR;
    const shift = this.slaughtering(hour);
    // Operating rule: when the freezing side cannot absorb what the line will pack in the next
    // 90 minutes, the line slows down to the downstream capacity (and drains the antecâmara).
    // Feed-forward: what is already between the shackles and the box arrives within 90 min anyway.
    const fill = this.ante / ANTE_CAPACITY;
    const cap = this.downstreamBoxesH();
    const horizonH = PROCESS_DELAY_MIN / 60;
    let inProcess = 0;
    for (const v of this.pipeline.values()) inProcess += v / BOX_KG;
    const projected = this.ante + inProcess - cap * horizonH;
    const storeLimited = this.freePositions() < 60;
    const limited = storeLimited || cap < NOMINAL_BOXES_H * 0.97 || fill > 0.6;
    const target = limited
      ? clamp(cap / NOMINAL_BOXES_H - Math.max(0, projected - 0.5 * ANTE_CAPACITY) / (horizonH * NOMINAL_BOXES_H), 0, 1)
      : 1;
    this.downFactor += (target - this.downFactor) * Math.min(1, dtMs / (4 * MIN));

    const want: number[] = [];
    this.lines.forEach((ln) => {
      if (!shift) {
        want.push(0);
        return;
      }
      if (this.simTime >= ln.microUntil && this.rng.next() < dtMs / (MICROSTOP_EVERY_MIN * MIN)) {
        ln.microUntil = this.simTime + this.rng.range(MICROSTOP_MIN[0], MICROSTOP_MIN[1]) * MIN;
      }
      const stopped = this.simTime < ln.microUntil;
      const nominal = ln.sif ? LINE_SIF_REDUCED : LINE_NOMINAL;
      want.push(stopped ? 0 : nominal * this.downFactor * dtH);
    });
    const totalWant = want.reduce((a, b) => a + b, 0);
    const share = totalWant > 0 ? Math.min(1, this.platformBirds / totalWant) : 0;
    // A shift starts at full speed: seed the smoothing instead of ramping up from zero.
    if (shift && !this.wasSlaughtering) this.lineSmooth = LINE_NOMINAL * LINES * this.downFactor;
    this.wasSlaughtering = shift;
    this.lineSmooth += ((totalWant * share) / dtH - this.lineSmooth) * Math.min(1, dtMs / (10 * MIN));
    const kg = this.platformKg;
    let finished = 0;
    if (shift) for (const w of [this.yieldCarc, this.yieldLive, this.lossDead, this.lossBirds, this.partialSum, this.doaDead]) w.add(0, dtMs);
    this.lines.forEach((ln, i) => {
      const hung = want[i] * share;
      this.platformBirds -= hung;
      const instRate = dtH > 0 ? hung / dtH : 0;
      ln.rate += (instRate - ln.rate) * Math.min(1, dtMs / (1.5 * MIN));
      if (hung <= 0) return;
      const extra = ln.contam - CONTAM_BASE;
      const pRate = PARTIAL_BASE + extra * 0.8;
      const tRate = TOTAL_BASE + extra * 0.12;
      const total = hung * tRate;
      const ok = hung - total;
      const partial = ok * pRate;
      const liveKg = hung * kg;
      const carcassGross = ok * kg * CARCASS_GROSS;
      const trim = carcassGross * pRate * TRIM_SHARE;
      const carcass = carcassGross - trim;
      const paws = ok * kg * PAWS;
      const giblets = ok * kg * GIBLETS;
      const cond = total * kg * (CARCASS_GROSS + PAWS + GIBLETS);
      const fin = (carcass + paws + giblets) * (1 - PROCESS_LOSS);
      finished += fin;
      const d = this.day;
      d.birds += hung;
      d.liveKg += liveKg;
      d.carcassKg += carcass;
      d.pawsKg += paws;
      d.gibletsKg += giblets;
      d.trimKg += trim;
      d.condKg += cond;
      d.partial += partial;
      d.total += total;
      for (const c of PARTIAL_CAUSES) {
        const v = c.id === "contam" ? hung * (PARTIAL_BASE * c.w + extra * 0.8) : hung * PARTIAL_BASE * c.w;
        d.causesP[c.label] = (d.causesP[c.label] ?? 0) + v;
      }
      for (const c of TOTAL_CAUSES) {
        const v = c.id === "contam" ? hung * (TOTAL_BASE * c.w + extra * 0.12) : hung * TOTAL_BASE * c.w;
        d.causesT[c.label] = (d.causesT[c.label] ?? 0) + v;
      }
      this.yieldCarc.add(carcass, 0);
      this.yieldLive.add(liveKg, 0);
      this.lossDead.add(total, 0);
      this.partialSum.add(partial, 0);
      this.hourNow.birds += hung;
      if (!this.warming) this.session.birds += hung;
      if (extra > 0) this.runCount((c) => (c.extraCond += extra * 0.8 * ok + extra * 0.12 * hung), "evisc");
    });
    if (finished > 0) {
      const m = Math.floor(this.simTime / MIN);
      this.pipeline.set(m, (this.pipeline.get(m) ?? 0) + finished);
    }
    // Lost production against the plan (97% availability), per incident.
    if (shift) {
      const plan = LINE_NOMINAL * 0.97 * dtH;
      const lostAll = Math.max(0, plan * LINES - want.reduce((s, w) => s + w * share, 0));
      const lostL2 = Math.max(0, plan - want[1] * share);
      this.runCount((c) => (c.lostBirds += lostAll), "tunnel", "storage");
      this.runCount((c) => (c.lostBirds += lostL2), "evisc");
    }
  }

  /** Boxes per hour the freezing tunnels and the cold store can absorb right now. */
  private downstreamBoxesH(): number {
    let tunnels = 0;
    for (const tn of this.tunnels) if (tn.temp <= TUNNEL_MAX_LOAD_TEMP) tunnels += TUNNEL_CAPACITY / tunnelDwellH(tn.temp);
    const free = this.freePositions();
    const store = free > 60 ? PUTAWAY_RATE : this.outRate + free;
    return Math.min(tunnels, store * BOXES_PER_PALLET);
  }

  private stepPipeline(dtMs: number): void {
    const cut = Math.floor(this.simTime / MIN) - PROCESS_DELAY_MIN;
    let kg = 0;
    // boxes of birds slaughtered before 03:00 (overtime) belong to the previous production day
    let lateKg = 0;
    for (const [m, v] of this.pipeline) {
      if (m <= cut) {
        if (m * MIN < this.day.start) lateKg += v;
        else kg += v;
        this.pipeline.delete(m);
      }
    }
    const total = kg + lateKg;
    this.packRate += (total / BOX_KG / (dtMs / HOUR) - this.packRate) * Math.min(1, dtMs / (10 * MIN));
    if (total <= 0) return;
    this.ante += total / BOX_KG;
    if (this.ante > ANTE_CAPACITY) {
      this.chilledHold += this.ante - ANTE_CAPACITY;
      this.ante = ANTE_CAPACITY;
    }
    this.packInto(this.day, kg);
    if (lateKg > 0 && this.prevDay) {
      this.packInto(this.prevDay, lateKg);
      const rec = this.prevDay.date >= this.pcpAnchor ? this.pcpDayAt(this.prevDay.date) : undefined;
      if (rec && rec.actualKg !== null) rec.actualKg = Math.round(rec.actualKg + lateKg);
    }
    this.hourNow.producedKg += total;
    if (!this.warming) this.session.finishedKg += total;
  }

  private packInto(d: Day, kg: number): void {
    if (kg <= 0) return;
    d.boxes += kg / BOX_KG;
    d.finishedKg += kg;
    for (const p of PRODUCTS) d.produced[p.id] = (d.produced[p.id] ?? 0) + kg * p.mix;
  }

  // ------------------------------------------------------------ freezing tunnels and cold storage
  private stepTunnels(dtMs: number): void {
    const dtH = dtMs / HOUR;
    const binIdx = Math.floor(this.simTime / (10 * MIN));
    // intake
    const caps = this.tunnels.map((tn) => {
      const wip = tn.bins.reduce((s, b) => s + b.boxes, 0);
      if (tn.temp > TUNNEL_MAX_LOAD_TEMP || tn.blocked) return 0;
      return Math.max(0, Math.min((TUNNEL_CAPACITY / tunnelDwellH(tn.temp)) * dtH, TUNNEL_CAPACITY - wip));
    });
    const capSum = caps.reduce((a, b) => a + b, 0);
    const moved = Math.min(this.ante, capSum);
    if (moved > 0) {
      this.tunnels.forEach((tn, i) => {
        const part = (moved * caps[i]) / capSum;
        if (part <= 0) return;
        const last = tn.bins[tn.bins.length - 1];
        if (last && last.idx === binIdx) last.boxes += part;
        else tn.bins.push({ boxes: part, progress: 0, idx: binIdx });
      });
      this.ante -= moved;
    }
    this.tunnelInRate += (moved / dtH - this.tunnelInRate) * Math.min(1, dtMs / (5 * MIN));
    if (this.chilledHold > 0 && this.ante < ANTE_CAPACITY) {
      const back = Math.min(this.chilledHold, ANTE_CAPACITY - this.ante);
      this.chilledHold -= back;
      this.ante += back;
    }
    // freezing progress
    for (const tn of this.tunnels) {
      const inc = dtH / tunnelDwellH(tn.temp);
      for (const b of tn.bins) b.progress += inc;
      while (tn.bins.length && tn.bins[0].progress >= 1) {
        tn.ready += tn.bins[0].boxes;
        tn.bins.shift();
      }
    }
    // put-away into the cold store
    const capPallets = Math.min(PUTAWAY_RATE * dtH, this.freePositions());
    const readyTotal = this.tunnels.reduce((s, tn) => s + tn.ready, 0);
    const want = readyTotal / BOXES_PER_PALLET;
    const put = Math.min(want, capPallets);
    if (put > 0) {
      for (const tn of this.tunnels) tn.ready -= (tn.ready / readyTotal) * put * BOXES_PER_PALLET;
      for (const p of PRODUCTS) this.storage[p.id] += put * p.mix;
    }
    for (const tn of this.tunnels) tn.blocked = tn.ready > 200;
    this.putawayRate += ((put * BOXES_PER_PALLET) / dtH - this.putawayRate) * Math.min(1, dtMs / (5 * MIN));
    // freezing-to-storage rate for the ante fill forecast
    const dAnte = (this.ante - this.lastAnte) / dtH;
    this.anteRate += (dAnte - this.anteRate) * Math.min(1, dtMs / (10 * MIN));
    this.lastAnte = this.ante;
    // external transfer while recovering from the storage scenario
    const sr = this.runs.get("storage");
    if (sr?.phase === "recovering") {
      const targetOcc = 0.88;
      const cur = this.storagePct() / 100;
      if (cur > targetOcc) {
        const remainingMin = Math.max(1, sr.def.recoveryMin - sr.recMin);
        const out = ((cur - targetOcc) * STORAGE_PALLETS * (dtMs / MIN)) / remainingMin;
        this.withdraw(out);
      }
    }
  }

  /** Free pallet positions below the practical maximum. */
  private freePositions(): number {
    return Math.max(0, STORAGE_PALLETS * STORAGE_PRACTICAL_MAX - this.storagePallets());
  }

  private storagePallets(): number {
    let s = 0;
    for (const p of PRODUCTS) s += this.storage[p.id];
    return s;
  }

  private storagePct(): number {
    return (100 * this.storagePallets()) / STORAGE_PALLETS;
  }

  /** Removes pallets from the store in the current product mix. */
  private withdraw(pallets: number): void {
    const total = this.storagePallets();
    if (total <= 0) return;
    for (const p of PRODUCTS) this.storage[p.id] = Math.max(0, this.storage[p.id] - (pallets * this.storage[p.id]) / total);
  }

  private setStorageOccupancy(pct: number): void {
    const total = this.storagePallets();
    const want = (STORAGE_PALLETS * pct) / 100;
    for (const p of PRODUCTS) this.storage[p.id] = total > 0 ? (this.storage[p.id] * want) / total : want * p.mix;
  }

  // ------------------------------------------------------------ expedition
  private stepLoadArrivals(dtMs: number, hour: number): void {
    // Domestic demand is what customers order; export bookings follow the stock (the balancing lever).
    const occ = this.storagePct() / 100;
    const fbExp = clamp(1 + (occ - STORAGE_TARGET) * 8, 0.4, 1.6);
    const exp = EXPORT_SHARE * fbExp;
    const rate = ((LOADS_PER_DAY * dispatchWeight(hour)) / DISPATCH_WEIGHT_SUM) * (1 - EXPORT_SHARE + exp);
    this.loadAcc += (rate * dtMs) / HOUR;
    if (this.loadAcc < this.loadNext) return;
    this.loadAcc -= this.loadNext;
    this.loadNext = this.gamma4();
    const market: "EXP" | "MI" = this.rng.next() < exp / (1 - EXPORT_SHARE + exp) ? "EXP" : "MI";
    if (market === "EXP" && this.isActive("storage")) {
      this.runCount((c) => (c.notTaken += 1), "storage");
      return;
    }
    this.spawnLoad(market);
  }

  private spawnLoad(market: "EXP" | "MI"): void {
    const n = ++this.loadSeq;
    const now = this.simTime;
    let vehicle: Vehicle;
    let dest: string;
    let destName: string;
    let customer: string;
    let port: string | undefined;
    let products: { id: ProductId; pallets: number }[];
    if (market === "EXP") {
      vehicle = "container";
      const c = this.rng.pick(COUNTRIES, (x) => x.share);
      dest = c.code;
      destName = c.name;
      port = c.port;
      customer = `Importador ${c.code}-${pad(this.rng.int(1, 12), 2)}`;
      const pid = this.rng.pick(c.products, (id) => PRODUCT_BY_ID[id].mix);
      products = [{ id: pid, pallets: VEHICLES.container.pallets }];
    } else {
      vehicle = this.rng.pick(DOMESTIC_VEHICLES, (x) => x.share).v;
      const uf = this.rng.pick(UFS, (x) => x.share);
      dest = uf.code;
      destName = uf.code;
      customer = `${this.rng.choice(CUSTOMER_KINDS)} ${uf.code}-${pad(this.rng.int(1, 60), 3)}`;
      const k = vehicle === "toco" ? this.rng.int(1, 2) : this.rng.int(2, 4);
      const pool = [...DOMESTIC_PRODUCTS];
      const chosen: ProductId[] = [];
      for (let i = 0; i < k && pool.length; i++) {
        const pid = this.rng.pick(pool, (id) => PRODUCT_BY_ID[id].mix);
        chosen.push(pid);
        pool.splice(pool.indexOf(pid), 1);
      }
      const total = VEHICLES[vehicle].pallets;
      let left = total;
      products = chosen.map((id, i) => {
        const p = i === chosen.length - 1 ? left : Math.max(1, Math.round(total / chosen.length + this.rng.range(-2, 2)));
        left -= p;
        return { id, pallets: p };
      });
      products = products.filter((p) => p.pallets > 0);
    }
    const pallets = products.reduce((s, p) => s + p.pallets, 0);
    const kg = pallets * BOXES_PER_PALLET * BOX_KG;
    let valueUsd = 0;
    let valueBrl = 0;
    for (const p of products) {
      const t = (p.pallets * BOXES_PER_PALLET * BOX_KG) / 1000;
      if (market === "EXP") valueUsd += t * PRODUCT_BY_ID[p.id].usdT;
      else valueBrl += t * PRODUCT_BY_ID[p.id].brlT;
    }
    if (market === "EXP") valueBrl = valueUsd * BRL_PER_USD;
    const plannedExit = now + (3.3 + VEHICLES[vehicle].loadMin / 60 - 2) * HOUR;
    const l: Load = {
      id: `CG-${pad(n, 3)}`,
      n,
      market,
      vehicle,
      dest,
      destName,
      customer,
      port,
      products,
      pallets,
      kg,
      valueBrl,
      valueUsd,
      nfes: [],
      stage: "road",
      stageStart: now,
      stageEnd: now + 3 * MIN,
      dock: -1,
      slot: 0,
      loadedPallets: 0,
      blocked: false,
      nfeState: "none",
      nfeStateAt: now,
      ticketIntegrated: false,
      divergencePct: 0,
      cutoff: market === "EXP" ? plannedExit + (PORT_HOURS + this.rng.range(1.5, 11)) * HOUR : 0,
      dockAfter: now + (3 + this.rng.range(APPOINTMENT_WAIT_MIN[0], APPOINTMENT_WAIT_MIN[1])) * MIN,
      t: { arrive: now + 3 * MIN },
    };
    this.loads.push(l);
    this.recentLoads.push(l);
    if (this.recentLoads.length > 160) this.recentLoads.shift();
  }

  private setLoad(l: Load, stage: Load["stage"], durMin = 0): void {
    l.stage = stage;
    l.stageStart = this.simTime;
    l.stageEnd = this.simTime + durMin * MIN;
  }

  private freeYardSlot(): number {
    return this.yardSlots.indexOf(null);
  }

  private stepLoads(dtMs: number): void {
    const now = this.simTime;
    // scale: outbound (gross) has priority, then inbound tare if the yard has room
    if (!this.fgScale) {
      const gross = this.loads.filter((l) => l.stage === "grossQueue").sort((a, b) => (a.t.loaded ?? 0) - (b.t.loaded ?? 0))[0];
      if (gross) {
        this.docks[gross.dock] = null;
        gross.dock = -1;
        this.fgScale = gross;
        this.setLoad(gross, "toScale", 1);
      } else if (this.freeYardSlot() >= 0) {
        const tare = this.loads.filter((l) => l.stage === "tareQueue").sort((a, b) => a.t.arrive - b.t.arrive)[0];
        if (tare) {
          this.fgScale = tare;
          this.setLoad(tare, "tare", FG_SCALE_MIN);
        }
      }
    }
    let outside = 0;
    for (const l of this.loads) {
      switch (l.stage) {
        case "road":
          if (now >= l.stageEnd) this.setLoad(l, "tareQueue");
          break;
        case "tareQueue":
          l.slot = outside++;
          break;
        case "tare":
          if (now >= l.stageEnd) {
            const slot = this.freeYardSlot();
            if (slot >= 0) {
              this.yardSlots[slot] = l.id;
              l.slot = slot;
              l.t.tare = now;
              l.blocked = false;
              this.fgScale = null;
              this.setLoad(l, "yardDock");
            } else l.blocked = true;
          }
          break;
        case "yardDock": {
          const dock = now >= l.dockAfter ? this.docks.indexOf(null) : -1;
          if (dock >= 0) {
            this.docks[dock] = l.id;
            this.yardSlots[l.slot] = null;
            l.dock = dock;
            this.setLoad(l, "toDock", 1);
          }
          break;
        }
        case "toDock":
          if (now >= l.stageEnd) {
            l.t.dockIn = now;
            this.setLoad(l, "loading", VEHICLES[l.vehicle].loadMin);
          }
          break;
        case "loading": {
          const dur = l.stageEnd - l.stageStart;
          const target = Math.min(l.pallets, (l.pallets * (now - l.stageStart)) / dur);
          const add = target - l.loadedPallets;
          if (add > 0) {
            for (const p of l.products) this.storage[p.id] = Math.max(0, this.storage[p.id] - (add * p.pallets) / l.pallets);
            l.loadedPallets = target;
            this.outStep += add;
          }
          if (now >= l.stageEnd) {
            l.loadedPallets = l.pallets;
            l.t.loaded = now;
            this.setLoad(l, "grossQueue");
          }
          break;
        }
        case "grossQueue":
          l.blocked = now - (l.t.loaded ?? now) > 10 * MIN;
          break;
        case "toScale":
          if (now >= l.stageEnd) {
            const diverge = this.rng.next() < 0.025;
            l.divergencePct = diverge ? this.rng.range(0.6, 1.3) * (this.rng.next() < 0.5 ? -1 : 1) : this.rng.range(-0.25, 0.25);
            this.setLoad(l, "gross", FG_SCALE_MIN + (diverge ? 12 : 0));
          }
          break;
        case "gross":
          if (now >= l.stageEnd) {
            if (l.t.gross === undefined) {
              l.t.gross = now;
              l.ticketIntegrated = !this.ticketsDown;
              l.nfeState = l.ticketIntegrated ? "erp" : "ticket";
              l.nfeStateAt = now;
            }
            const slot = this.freeYardSlot();
            if (slot >= 0) {
              this.yardSlots[slot] = l.id;
              l.slot = slot;
              l.blocked = false;
              this.fgScale = null;
              this.setLoad(l, "yardNfe");
            } else l.blocked = true;
          }
          break;
        case "gate":
          if (now >= l.stageEnd) {
            l.t.exit = now;
            this.ship(l);
            this.setLoad(l, "leaving", 4);
          }
          break;
        case "leaving":
          if (now >= l.stageEnd) l.stage = "gone";
          break;
        default:
          break;
      }
      // invoicing runs for loads weighed (yard or still on the scale)
      if (l.t.gross !== undefined && l.nfeState !== "done") this.stepInvoice(l);
      if (l.nfeState === "done" && l.stage === "yardNfe") {
        this.yardSlots[l.slot] = null;
        this.setLoad(l, "gate", GATE_MIN);
      } else if (l.nfeState === "done" && l.stage === "gross" && l.blocked) {
        this.fgScale = null;
        l.blocked = false;
        this.setLoad(l, "gate", GATE_MIN);
      }
    }
    this.loads = this.loads.filter((l) => l.stage !== "gone");
    this.outRate += (this.outStep / (dtMs / HOUR) - this.outRate) * Math.min(1, dtMs / (45 * MIN));
    this.outStep = 0;
  }

  private stepInvoice(l: Load): void {
    const now = this.simTime;
    switch (l.nfeState) {
      case "ticket":
        if (!this.ticketsDown) {
          l.ticketIntegrated = true;
          l.nfeState = "erp";
          l.nfeStateAt = now;
        } else if (this.manualMode && !this.manualBusy) {
          this.manualBusy = l;
          this.manualUntil = now + 25 * MIN;
          l.nfeState = "manual";
          l.nfeStateAt = now;
        }
        break;
      case "manual":
        if (now >= this.manualUntil && this.manualBusy === l) {
          this.manualBusy = null;
          l.ticketIntegrated = true;
          l.nfeState = "erp";
          l.nfeStateAt = now;
          this.runCount((c) => (c.manual += 1), "fgscale");
        } else if (!this.ticketsDown) {
          if (this.manualBusy === l) this.manualBusy = null;
          l.ticketIntegrated = true;
          l.nfeState = "erp";
          l.nfeStateAt = now;
        }
        break;
      case "erp":
        if (now - l.nfeStateAt >= ERP_INVOICE_MIN * MIN) {
          this.createNfes(l);
          l.nfeState = "sefaz";
          l.nfeStateAt = now;
          l.t.invoiceStart = now;
        }
        break;
      case "sefaz":
        if (l.nfes.length && l.nfes.every((n) => n.state === "authorized")) {
          l.nfeState = "danfe";
          l.nfeStateAt = now;
          l.t.authorized = now;
        }
        break;
      case "danfe":
        if (now - l.nfeStateAt >= DANFE_MIN * MIN) {
          l.nfeState = "done";
          l.nfeStateAt = now;
        }
        break;
      default:
        break;
    }
  }

  private createNfes(l: Load): void {
    const count = l.market === "EXP" ? 1 : l.vehicle === "truck" ? this.rng.int(2, 5) : this.rng.int(1, 3);
    const cfop = l.market === "EXP" ? "7101" : l.dest === "PR" ? "5101" : "6101";
    for (let i = 0; i < count; i++) {
      const number = this.nfeSeq++;
      const nfe: Nfe = {
        number,
        key: this.nfeKey(number),
        loadId: l.id,
        cfop,
        dest: l.market === "EXP" ? l.destName : l.dest,
        valueBrl: l.valueBrl / count,
        tpEmis: 1,
        cStat: 0,
        xMotivo: "Aguardando transmissão",
        requestedAt: this.simTime,
        doneAt: this.simTime,
        attempts: 0,
        state: "queued",
      };
      l.nfes.push(nfe);
      this.nfes.push(nfe);
    }
  }

  /** 44-digit access key with the issuer's CNPJ masked (fictitious company). */
  private nfeKey(number: number): string {
    const d = new Date(this.simTime);
    const yymm = `${pad(d.getFullYear() % 100, 2)}${pad(d.getMonth() + 1, 2)}`;
    const cnf = pad(this.rng.int(0, 99999999), 8);
    const raw = `41${yymm}${"•".repeat(14)}55001${pad(number, 9)}1${cnf}${this.rng.int(0, 9)}`;
    return raw.match(/.{1,4}/g)?.join(" ") ?? raw;
  }

  private stepNfe(): void {
    const now = this.simTime;
    for (const n of this.nfes) {
      if (n.state === "authorized") continue;
      if (n.state === "rejected") {
        if (!this.certExpired) {
          n.state = "queued";
          n.doneAt = now;
        } else continue;
      }
      if ((n.state === "queued" || n.state === "retry") && now >= n.doneAt) {
        n.attempts++;
        if (this.certExpired) {
          n.state = "sent";
          n.doneAt = now + 400;
          n.cStat = -281;
        } else if (this.sefazDown && !this.svcActive) {
          n.state = "sent";
          n.doneAt = now + 30_000;
          n.cStat = -108;
        } else {
          const svc = this.svcActive;
          const median = svc ? SVC_MEDIAN_S : NFE_MEDIAN_S;
          const lat = median * Math.exp(NFE_SIGMA * this.rng.normal());
          n.tpEmis = svc ? 7 : 1;
          n.state = "sent";
          n.doneAt = now + lat * 1000;
          n.latencyS = lat;
          n.cStat = -100;
        }
        n.xMotivo = "Enviada à autorizadora";
        this.emit("nfeSent", n);
      } else if (n.state === "sent" && now >= n.doneAt) {
        const code = -n.cStat;
        if (code === 100) {
          n.state = "authorized";
          n.cStat = 100;
          n.xMotivo = "Autorizado o uso da NF-e";
          n.authorizedAt = n.doneAt;
          n.protocol = `141${pad(new Date(now).getFullYear() % 100, 2)}${pad(this.protoSeq++, 10)}`;
          this.day.nfeAuth++;
          if (n.tpEmis === 7) {
            this.day.nfeSvc++;
            this.runCount((c) => (c.svc += 1), "sefaz");
          }
          if (!this.warming) this.session.nfes++;
          this.nfeLat.push({ t: now, s: n.latencyS ?? 1 });
          if (this.nfeLat.length > 60) this.nfeLat.shift();
        } else if (code === 281) {
          n.state = "rejected";
          n.cStat = 281;
          n.xMotivo = "Rejeição: Certificado Transmissor Data Validade";
          this.day.nfeRej++;
          this.runCount((c) => (c.rejected += 1), "cert");
        } else {
          const run = this.runs.get("sefaz");
          const c = run && run.elapsedMin >= 10 ? 109 : 108;
          n.state = "retry";
          n.cStat = c;
          n.xMotivo = c === 108 ? "Serviço paralisado momentaneamente" : "Serviço paralisado sem previsão";
          n.doneAt = now + 60_000;
        }
        this.pushNfe(n);
        this.emit("nfeResult", n);
      }
    }
    this.nfes = this.nfes.filter((n) => n.state !== "authorized");
  }

  private pushNfe(n: Nfe): void {
    const i = this.nfeFeed.findIndex((x) => x.number === n.number);
    if (i >= 0) this.nfeFeed.splice(i, 1);
    this.nfeFeed.unshift({ ...n });
    if (this.nfeFeed.length > 14) this.nfeFeed.pop();
  }

  private ship(l: Load): void {
    const d = this.day;
    d.shippedKg += l.kg;
    d.loads++;
    if (l.market === "EXP") {
      d.loadsExp++;
      d.exportKg += l.kg;
      d.exportUsd += l.valueUsd;
      const c = (d.byCountry[l.dest] ??= { kg: 0, usd: 0 });
      c.kg += l.kg;
      c.usd += l.valueUsd;
      l.t.portEta = this.simTime + PORT_HOURS * HOUR;
      if (l.t.portEta > l.cutoff) d.missedCutoff++;
    } else {
      d.loadsMi++;
      d.domesticKg += l.kg;
      d.domesticBrl += l.valueBrl;
      const u = (d.byUf[l.dest] ??= { kg: 0, brl: 0 });
      u.kg += l.kg;
      u.brl += l.valueBrl;
    }
    for (const p of l.products) d.byProduct[p.id] = (d.byProduct[p.id] ?? 0) + (p.pallets * BOXES_PER_PALLET * BOX_KG);
    this.hourNow.shippedKg += l.kg;
    if (!this.warming) this.session.shippedKg += l.kg;
    this.emit("shipped", l);
  }

  // ------------------------------------------------------------ scenarios
  private startRun(id: ScenarioId): void {
    const def = SCENARIO_BY_ID[id];
    this.runs.set(id, { def, phase: "active", startedSim: this.simTime, elapsedMin: 0, recMin: 0, k: 0, opened: false, c: newCounters() });
    if (id === "storage") {
      // Day 4 without container pick-ups: the store is full and the export bookings not yet at a dock are rolled.
      this.setStorageOccupancy(98.5);
      // On day 4 there is no export load at the plant: containers not yet closed are cancelled
      // (their pallets go back to the store) and only the domestic market keeps picking.
      const run = this.runs.get(id);
      const early = new Set(["road", "tareQueue", "tare", "yardDock", "toDock", "loading"]);
      this.loads = this.loads.filter((l) => {
        const drop = l.market === "EXP" && early.has(l.stage);
        if (drop) {
          if (l.stage === "yardDock") this.yardSlots[l.slot] = null;
          if (l.dock >= 0 && this.docks[l.dock] === l.id) this.docks[l.dock] = null;
          if (this.fgScale === l) this.fgScale = null;
          for (const p of l.products) this.storage[p.id] += (l.loadedPallets * p.pallets) / l.pallets;
          if (run) run.c.notTaken++;
          this.recentLoads = this.recentLoads.filter((x) => x !== l);
        }
        return !drop;
      });
      this.setStorageOccupancy(98.5);
      this.outRate *= 1 - EXPORT_SHARE;
    }
  }

  private endRun(run: Run): void {
    run.phase = "recovering";
    run.recMin = 0;
  }

  private advanceRuns(dtMs: number): void {
    const dMin = dtMs / MIN;
    for (const run of [...this.runs.values()]) {
      const def = run.def;
      if (run.phase === "active") {
        run.elapsedMin += dMin;
        run.k = Math.min(1, run.elapsedMin / def.rampMin);
        if (!run.opened && run.elapsedMin >= def.mttdMin) run.opened = true;
        if (run.elapsedMin >= def.durationMin) this.endRun(run);
      } else {
        run.recMin += dMin;
        run.k = Math.max(0, 1 - run.recMin / def.recoveryMin);
        if (run.recMin >= def.recoveryMin) this.finishRun(run);
      }
    }
  }

  private finishRun(run: Run): void {
    this.runs.delete(run.def.id);
    run.opened = true;
    if (run.def.id === "cert") this.certRenewed = true;
    this.resolved.unshift({ def: run.def, startedSim: run.startedSim, durMin: run.elapsedMin, c: run.c });
    if (this.resolved.length > 5) this.resolved.pop();
    if (!this.warming) {
      this.session.incidents.push({
        name: run.def.name,
        mttdMin: run.def.mttdMin,
        impact: this.impacts(run.def.id, run.c, false)
          .slice(0, 2)
          .map((i) => `${i.label}: ${i.value}`)
          .join(" · "),
      });
    }
  }

  private runCount(fn: (c: RunCounters) => void, ...ids: ScenarioId[]): void {
    if (this.warming) return;
    for (const id of ids) {
      const r = this.runs.get(id);
      if (r) fn(r.c);
    }
  }

  private trackRuns(): void {
    if (this.warming || this.runs.size === 0) return;
    const held = this.heldLoads();
    const risk = this.cutoffRisk();
    for (const r of this.runs.values()) {
      const c = r.c;
      if (held.count > c.heldPeak) c.heldPeak = held.count;
      if (held.kg > c.heldKgPeak) c.heldKgPeak = held.kg;
      if (held.brl > c.heldBrlPeak) c.heldBrlPeak = held.brl;
      if (risk > c.riskPeak) c.riskPeak = risk;
      const y = this.yieldPct();
      if (y < c.minYield) c.minYield = y;
    }
  }


  // ------------------------------------------------------------ PCP: production plan
  /** Regular end of the last slaughter window of the day (without overtime). */
  private regularEnd(d: PcpDay | undefined): number {
    return d?.oneShift ? SHIFTS[0][1] : SHIFTS[1][1];
  }

  /** Overtime limit for a day: the configured one, bounded by the end of the production day. */
  private overtimeCap(d: PcpDay | undefined): number {
    const technical = PROD_DAY_END_H - this.regularEnd(d);
    const set = this.pcpConfig.overtimeMaxH;
    return set === null ? technical : Math.min(set, technical);
  }

  private extraDayBirds(shifts: 1 | 2): number {
    return Math.round((shifts * EXTRA_SHIFT_H * PLAN_RATE) / 100) * 100;
  }

  /** Slaughter windows of the running production day (hours 3–27), approved overtime included. */
  private windows(): [number, number][] {
    const d = this.pcpCur;
    const ext = d?.extraH ?? 0;
    if (d?.oneShift) return [[SHIFTS[0][0], SHIFTS[0][1] + ext]];
    return [
      [SHIFTS[0][0], SHIFTS[0][1]],
      [SHIFTS[1][0], SHIFTS[1][1] + ext],
    ];
  }

  private slaughtering(h: number): boolean {
    for (const [a, b] of this.windows()) if (h >= a && h < b) return true;
    return false;
  }

  private slaughterHoursLeft(h: number): number {
    let left = 0;
    for (const [a, b] of this.windows()) left += Math.max(0, b - Math.max(a, h));
    return left;
  }

  private shiftName(h: number): string {
    const w = this.windows();
    for (let i = 0; i < w.length; i++) {
      const [a, b] = w[i];
      if (h >= a && h < b) return h >= SHIFTS[i][1] ? "Hora extra" : i === 0 ? "Turno 1" : "Turno 2";
    }
    if (w.length > 1 && h >= w[0][1] && h < w[1][0]) return "Troca de turno";
    return "Higienização";
  }

  private monthKey(date: number): number {
    const d = new Date(date);
    return d.getFullYear() * 12 + d.getMonth();
  }

  private pcpDayAt(date: number): PcpDay | undefined {
    if (this.monthKey(date) !== this.pcpMonth) return undefined;
    return this.pcpDays[new Date(date).getDate() - 1];
  }

  private refreshPcpCur(): void {
    this.pcpCur = this.day.date >= this.pcpAnchor ? this.pcpDayAt(this.day.date) : undefined;
  }

  /** Builds the PCP calendar of the month of `prodDate`; days before the anchor get a synthetic history. */
  private buildPcp(prodDate: number): void {
    const d = new Date(prodDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    this.pcpMonth = y * 12 + m;
    this.pcpDays = this.monthCalendar(y, m, this.pcpAnchor);
    const py = m === 0 ? y - 1 : y;
    const pm = (m + 11) % 12;
    this.pcpPrev = this.summarize(this.monthCalendar(py, pm, Infinity), py, pm);
    this.refreshPcpCur();
  }

  private monthCalendar(y: number, m: number, simFrom: number): PcpDay[] {
    const n = new Date(y, m + 1, 0).getDate();
    const rng = new Rng((this.seed ^ Math.imul(y * 12 + m + 1, 2654435761)) >>> 0);
    const days: PcpDay[] = [];
    let deficit = 0;
    // Some months have one major loss (most of a day), recovered with a Saturday shift.
    const major = rng.next() < 0.6 ? rng.int(2, 18) : -1;
    for (let dom = 1; dom <= n; dom++) {
      const dt = new Date(y, m, dom);
      const dow = dt.getDay();
      const holiday = holidayName(dt);
      const kind: PcpDayKind = holiday ? "feriado" : dow === 0 ? "domingo" : dow === 6 ? "sabado" : "util";
      const key = `${y}-${m + 1}-${dom}`;
      // The lots programmed by the integration (fomento) move the plan a little from day to day.
      const planBirds = kind === "util" ? Math.round((PLAN_BIRDS_DAY * (1 + (hash01(key, this.seed) - 0.5) * 0.016)) / 500) * 500 : 0;
      const finPerBird = PLAN_FIN_PER_BIRD * (1 + (hash01(key, this.seed + 1) - 0.5) * 0.02);
      const day: PcpDay = {
        date: dt.getTime(),
        dom,
        dow,
        kind,
        holiday,
        planBirds,
        planKg: Math.round((planBirds * finPerBird) / 100) * 100,
        extraDay: false,
        oneShift: false,
        extraPlanBirds: 0,
        extraPlanKg: 0,
        extraH: 0,
        actualBirds: null,
        actualKg: null,
      };
      if (day.date < simFrom) {
        // Synthetic history: days around the plan, a bad day now and then, recovered with
        // overtime on the next working days or, for large deficits, a Saturday shift.
        let birds = 0;
        if (kind === "util") {
          const isMajor = dom >= major && major > 0 && !days.some((d) => d.cause && (PLAN_MAJOR_CAUSES as readonly string[]).includes(d.cause));
          const bad = !isMajor && rng.next() < 0.12;
          const f = isMajor ? rng.range(0.42, 0.6) : bad ? rng.range(0.86, 0.95) : clamp(1.006 + rng.normal() * 0.005, 0.99, 1.02);
          if (isMajor) day.cause = rng.choice(PLAN_MAJOR_CAUSES);
          else if (bad) day.cause = rng.choice(PLAN_LOSS_CAUSES);
          if (deficit > 0.5 * PLAN_RATE) day.extraH = Math.min(HISTORY_OVERTIME_H, quarterUp(deficit / PLAN_RATE));
          birds = planBirds * f + day.extraH * PLAN_RATE * rng.range(0.96, 1);
          deficit += planBirds - birds;
        } else if (kind === "sabado" && deficit > 4 * PLAN_RATE) {
          day.extraDay = true;
          day.oneShift = true;
          day.extraPlanBirds = EXTRA_SHIFT_BIRDS;
          day.extraPlanKg = Math.round((EXTRA_SHIFT_BIRDS * finPerBird) / 100) * 100;
          birds = EXTRA_SHIFT_BIRDS * rng.range(0.97, 1);
          deficit -= birds;
        }
        day.actualBirds = Math.round(birds);
        day.actualKg = Math.round(birds * finPerBird * (1 + rng.normal() * 0.004));
      }
      days.push(day);
    }
    return days;
  }

  private summarize(days: PcpDay[], y: number, m: number): PcpView["previous"] {
    let plan = 0;
    let actual = 0;
    let extraHours = 0;
    let extraDays = 0;
    for (const d of days) {
      plan += d.planBirds;
      actual += d.actualBirds ?? 0;
      extraHours += d.extraH;
      if (d.extraDay) extraDays++;
    }
    return { label: `${MONTHS[m]} de ${y}`, planBirds: plan, actualBirds: actual, adherence: plan > 0 ? (100 * actual) / plan : 0, extraHours, extraDays };
  }

  /** Records the actuals of a simulated production day in the calendar. */
  private closePcpDay(prev: Day | undefined): void {
    if (!prev || prev.date < this.pcpAnchor) return;
    const d = this.pcpDayAt(prev.date);
    if (!d) return;
    d.actualBirds = Math.round(prev.birds);
    d.actualKg = Math.round(prev.finishedKg);
  }

  private openPcpDay(): void {
    if (this.day.date >= this.pcpAnchor && this.monthKey(this.day.date) !== this.pcpMonth) {
      // the session crossed into a new month: the closing month becomes the previous one
      const old = new Date(this.pcpDays[0]?.date ?? this.day.date);
      const closing = this.summarize(this.pcpDays, old.getFullYear(), old.getMonth());
      this.buildPcp(this.day.date);
      this.pcpPrev = closing;
    }
    this.refreshPcpCur();
    const d = this.pcpCur;
    if (d && d.kind !== "util" && !d.extraDay) {
      // The simulated plant slaughters every day: a weekend or holiday on the clock is an extra day.
      d.extraDay = true;
      d.extraPlanBirds = PLAN_BIRDS_DAY;
      d.extraPlanKg = Math.round((PLAN_BIRDS_DAY * PLAN_FIN_PER_BIRD) / 100) * 100;
    }
  }

  private pcpView(ph: number): PcpView {
    const t = this.pcpCur ?? this.pcpDays[0];
    const util = t.kind === "util";
    const planBirds = util ? t.planBirds : t.extraPlanBirds;
    const planKg = util ? t.planKg : t.extraPlanKg;
    const planWin: readonly (readonly [number, number])[] = t.oneShift ? [SHIFTS[0]] : SHIFTS;
    const planH = planWin.reduce((a, [x, y]) => a + y - x, 0);
    const elapsed = (h: number) => planWin.reduce((a, [x, y]) => a + clamp(h - x, 0, y - x), 0);
    const planBirdsToNow = (planBirds * elapsed(ph)) / planH;
    const planKgToNow = (planKg * elapsed(ph - PROCESS_DELAY_MIN / 60)) / planH;
    const actualBirds = this.day.birds;
    const actualKg = this.day.finishedKg;
    const adherence = planBirdsToNow >= 0.5 * PLAN_RATE ? (100 * actualBirds) / planBirdsToNow : null;
    const kgAdherence = planKgToNow >= 0.5 * PLAN_RATE * PLAN_FIN_PER_BIRD ? (100 * actualKg) / planKgToNow : null;
    const projectedToday = actualBirds + this.slaughterHoursLeft(ph) * PLAN_RATE;
    const windows = this.windows();
    const endHour = windows[windows.length - 1][1];

    let planM = 0;
    let planKgM = 0;
    let planToDate = 0;
    let past = 0;
    let pastKg = 0;
    let future = 0;
    let workdays = 0;
    let workdaysLeft = 0;
    let extraHours = 0;
    let extraDays = 0;
    for (const d of this.pcpDays) {
      if (d.kind === "util") {
        planM += d.planBirds;
        planKgM += d.planKg;
        workdays++;
      }
      extraHours += d.extraH;
      if (d.extraDay) extraDays++;
      if (d.date < t.date) {
        planToDate += d.planBirds;
        past += d.actualBirds ?? 0;
        pastKg += d.actualKg ?? 0;
      } else if (d.date > t.date) {
        if (d.kind === "util") {
          future += d.planBirds;
          workdaysLeft++;
        } else if (d.extraDay) future += d.extraPlanBirds;
      }
    }
    if (util) planToDate += planBirdsToNow;
    const actualM = past + actualBirds;
    const projected = past + projectedToday + future;
    const gap = planM - projected;
    const recovery = this.recovery(t, ph, planBirds - projectedToday, gap, projected, planM, workdaysLeft);
    // the month tile follows the month gap; a day-only recommendation does not put the month at risk
    const monthLevel: Level =
      recovery.kind === "unrecoverable" ? "critical" : recovery.scope === "month" && recovery.kind !== "none" ? "warning" : "ok";

    const days: PcpDayView[] = this.pcpDays.map((d) => {
      const when = d.date < t.date ? "past" : d.date === t.date ? "today" : "future";
      const plan = d.kind === "util" ? d.planBirds : d.extraPlanBirds;
      const birds = when === "today" ? Math.round(actualBirds) : d.actualBirds;
      const adh = when === "today" ? adherence : when === "past" && plan > 0 && birds !== null ? (100 * birds) / plan : null;
      const level = when === "today" ? todayLevel(actualBirds - planBirdsToNow, planBirdsToNow, adherence !== null) : adherenceLevel(adh);
      return {
        date: d.date,
        dom: d.dom,
        dow: d.dow,
        kind: d.kind,
        holiday: d.holiday,
        planBirds: d.planBirds,
        planKg: d.planKg,
        extraDay: d.extraDay,
        extraPlanBirds: d.extraPlanBirds,
        extraPlanKg: d.extraPlanKg,
        extraH: d.extraH,
        actualBirds: birds,
        actualKg: when === "today" ? Math.round(actualKg) : d.actualKg,
        cause: d.cause,
        when,
        adherence: adh,
        level,
      };
    });

    const hourly: PcpView["hourly"] = [];
    const lastH = Math.ceil(endHour) - 1;
    for (let h = Math.floor(planWin[0][0]); h <= lastH; h++) {
      const overlap = planWin.reduce((a, [x, y]) => a + Math.max(0, Math.min(h + 1, y) - Math.max(h, x)), 0);
      const start = t.date + h * HOUR;
      const pt = this.hourly.find((x) => Math.abs(x.start - start) < 60_000);
      hourly.push({ hour: h, plan: (planBirds * overlap) / planH, actual: start > this.simTime ? null : (pt?.birds ?? 0) });
    }

    const dt = new Date(t.date);
    return {
      monthLabel: `${MONTHS[dt.getMonth()]} de ${dt.getFullYear()}`,
      prodDate: t.date,
      today: {
        kind: t.kind,
        extraDay: t.extraDay,
        planBirds,
        planKg,
        planBirdsToNow,
        planKgToNow,
        actualBirds,
        actualKg,
        adherence,
        kgAdherence,
        deltaBirds: actualBirds - planBirdsToNow,
        projectedBirds: projectedToday,
        extraH: t.extraH,
        endHour,
        level: todayLevel(actualBirds - planBirdsToNow, planBirdsToNow, adherence !== null),
      },
      month: {
        planBirds: planM,
        planKg: planKgM,
        planToDateBirds: planToDate,
        actualBirds: actualM,
        actualKg: pastKg + actualKg,
        adherence: planToDate > 0 ? (100 * actualM) / planToDate : 100,
        projectedBirds: projected,
        gapBirds: gap,
        gapKg: gap * PLAN_FIN_PER_BIRD,
        workdays,
        workdaysLeft,
        extraHours,
        extraDays,
        level: monthLevel,
      },
      previous: this.pcpPrev,
      recovery,
      config: { ...this.pcpConfig },
      overtimeCapH: Math.floor(this.overtimeCap(t) * 4) / 4,
      extraDayH: this.pcpConfig.extraDayShifts * EXTRA_SHIFT_H,
      extraDayBirds: this.extraDayBirds(this.pcpConfig.extraDayShifts),
      days,
      hourly,
    };
  }

  /** What the PCP needs: close the day with overtime, or the month with overtime on the next days or an extra day. */
  private recovery(t: PcpDay, ph: number, dayGap: number, gap: number, projected: number, planM: number, workdaysLeft: number): PcpRecovery {
    const tol = 0.25 * PLAN_RATE;
    const hours = gap > tol ? quarterUp(gap / PLAN_RATE) : 0;
    const dayHours = dayGap > tol ? quarterUp(dayGap / PLAN_RATE) : 0;
    const end = this.regularEnd(t);
    const running = ph < end + t.extraH;
    const overtimeToday = running ? Math.max(0, Math.floor(this.overtimeCap(t) * 4) / 4 - t.extraH) : 0;
    // future working days run both shifts; Saturdays come first as extra days, then Sundays and holidays
    const capPerDay = Math.floor(this.overtimeCap(undefined) * 4) / 4;
    const capDays = workdaysLeft * capPerDay;
    const free = this.pcpDays
      .filter((d) => d.kind !== "util" && d.date > t.date && !d.extraDay)
      .sort((a, b) => (a.kind === "sabado" ? 0 : 1) - (b.kind === "sabado" ? 0 : 1) || a.date - b.date);
    const scheduled = this.pcpDays.filter((d) => d.extraDay && d.date > t.date).map((d) => d.date);
    const shifts = this.pcpConfig.extraDayShifts;
    const extraH = shifts * EXTRA_SHIFT_H;
    const base = { scope: "month" as const, dayGapBirds: dayGap, hours, overtimeToday, suggestTodayH: 0, extraDay: free[0]?.date, extraScheduled: scheduled };
    const birds = fmtInt(gap);
    const next = (n: number) => (n === 1 ? "no próximo dia útil" : `nos próximos ${n} dias úteis`);
    const monthPct = fmtPct(planM > 0 ? (100 * projected) / planM : 100, 1);
    const dayName = (d: PcpDay) => `${d.kind === "sabado" ? "sábado" : d.kind === "domingo" ? "domingo" : (d.holiday ?? "feriado")} ${fmtDate(d.date)}`;
    if (dayHours > 0 && overtimeToday > 0 && hours <= Math.min(dayHours, overtimeToday)) {
      // Close the day: today's birds are already scheduled for catching and transport.
      const h = Math.min(dayHours, overtimeToday);
      const rest = dayGap - h * PLAN_RATE;
      return {
        ...base,
        scope: "day",
        hours: h,
        kind: "overtime-today",
        suggestTodayH: h,
        title: `Aprovar ${fmtH(h)} de hora extra hoje`,
        detail: `O dia vai fechar ${fmtInt(dayGap)} aves abaixo do plano, e os lotes de hoje já estão em apanha e transporte. Com ${fmtH(h)} a mais, o abate vai até ${fmtHour(
          end + t.extraH + h,
        )}${rest > tol ? `; as ${fmtInt(rest)} aves restantes voltam ao fomento para os próximos dias` : ""}.${
          hours === 0 ? ` No mês, a meta segue garantida (projeção ${monthPct}).` : ""
        }`,
      };
    }
    if (hours === 0)
      return {
        ...base,
        kind: "none",
        title: "Meta do mês garantida no ritmo planejado",
        detail: `Projeção de fechamento: ${fmtInt(projected)} aves, ${monthPct} da meta do PCP.`,
      };
    if (hours <= overtimeToday)
      return {
        ...base,
        kind: "overtime-today",
        suggestTodayH: hours,
        title: `Aprovar ${fmtH(hours)} de hora extra hoje`,
        detail: `Faltam ${birds} aves para a meta do mês. Com ${fmtH(hours)} a mais, o abate vai até ${fmtHour(end + t.extraH + hours)}.`,
      };
    const spread = (h: number) => {
      const rest = Math.max(0, h - overtimeToday);
      const n = Math.max(1, Math.ceil(rest / Math.max(0.25, capPerDay) - 1e-9));
      return `${overtimeToday > 0 ? `${fmtH(overtimeToday)} hoje e ` : ""}${fmtH(quarterUp(rest / n))} por dia ${next(n)}`;
    };
    if (hours < PREFER_EXTRA_DAY_H && hours <= overtimeToday + capDays)
      return {
        ...base,
        kind: "overtime-days",
        suggestTodayH: overtimeToday,
        title: `${fmtH(hours)} de hora extra até o fim do mês`,
        detail: `Faltam ${birds} aves: ${spread(hours)}.`,
      };
    if (free.length && hours <= extraH * free.length + overtimeToday + capDays) {
      const n = clamp(Math.round(hours / extraH), 1, free.length);
      const rest = Math.max(0, hours - n * extraH);
      const list = free.slice(0, n).map(dayName).join(" e ");
      return {
        ...base,
        kind: "extra-day",
        suggestTodayH: Math.min(overtimeToday, quarterUp(rest)),
        title: n === 1 ? `Programar dia extra de abate (${list})` : `Programar ${n} dias extras de abate (${list})`,
        detail: `Faltam ${birds} aves (${fmtH(hours)} de abate). Cada dia extra configurado tem ${shifts} turno(s), ≈ ${fmtInt(this.extraDayBirds(shifts))} aves${
          rest > 0 ? `; o restante (${fmtH(rest)}) vira hora extra nos dias úteis` : ""
        }. As aves não abatidas continuam nos integrados, ganhando peso e consumindo ração.`,
      };
    }
    if (hours <= overtimeToday + capDays)
      return {
        ...base,
        kind: "overtime-days",
        suggestTodayH: overtimeToday,
        title: `${fmtH(hours)} de hora extra até o fim do mês`,
        detail: `Faltam ${birds} aves e não há dia livre para um abate extra: ${spread(hours)}.`,
      };
    return {
      ...base,
      kind: "unrecoverable",
      suggestTodayH: overtimeToday,
      title: `Meta do mês não fecha: faltam ${birds} aves`,
      detail: `Nem a hora extra configurada${free.length ? " nem os dias livres restantes" : ""} recuperam ${fmtH(hours)} de abate. O PCP leva o saldo para o próximo mês, junto com o fomento (alojamento dos lotes).`,
    };
  }

  // ------------------------------------------------------------ derived values
  private heldLoads(): { count: number; kg: number; brl: number } {
    let count = 0;
    let kg = 0;
    let brl = 0;
    const now = this.simTime;
    for (const l of this.loads) {
      if (!LOADED_STAGES.has(l.stage) || l.nfeState === "done") continue;
      const since = l.t.gross ?? l.t.loaded ?? now;
      if (now - since < 10 * MIN) continue;
      count++;
      kg += l.kg;
      brl += l.valueBrl;
    }
    return { count, kg, brl };
  }

  private cutoffRisk(): number {
    let n = 0;
    for (const l of this.loads) {
      if (l.market !== "EXP" || l.stage === "leaving") continue;
      const remaining = l.stage === "gate" ? 0.05 : l.nfeState === "done" || l.nfeState === "danfe" ? 0.1 : 0.4;
      if (this.simTime + (remaining + PORT_HOURS) * HOUR > l.cutoff) n++;
    }
    return n;
  }

  private yieldPct(): number {
    return this.yieldLive.v > 0 ? (100 * this.yieldCarc.v) / this.yieldLive.v : 0;
  }

  private condemnPct(): number {
    return this.lossBirds.v > 0 ? (100 * this.lossDead.v) / this.lossBirds.v : 0;
  }

  private partialPct(): number {
    return this.lossBirds.v > 0 ? (100 * this.partialSum.v) / this.lossBirds.v : 0;
  }

  private doaPct(): number {
    return this.lossBirds.v > 0 ? (100 * this.doaDead.v) / this.lossBirds.v : 0;
  }

  private nfeP95(): number {
    if (!this.nfeLat.length) return 0;
    const s = this.nfeLat.map((x) => x.s).sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
  }

  private nfeMode(): Snapshot["nfeMode"] {
    if (this.certExpired) return "cert";
    if (this.svcActive) return "svc";
    if (this.sefazDown) return "down";
    return "normal";
  }

  private sefazStatus(): { code: number; text: string } {
    if (this.sefazDown) {
      const run = this.runs.get("sefaz");
      return run && run.elapsedMin >= 10
        ? { code: 109, text: "Paralisado sem previsão" }
        : { code: 108, text: "Paralisado momentaneamente" };
    }
    return { code: 107, text: "Serviço em operação" };
  }

  private certDays(): number {
    if (this.certExpired) return 0;
    return this.certRenewed ? 365 : CERT_DAYS;
  }

  private linePlan(hour: number): number {
    return this.slaughtering(hour) ? LINE_NOMINAL * LINES : 0;
  }

  private lineRate(): number {
    return this.lineSmooth;
  }

  // ------------------------------------------------------------ health
  private health(k: KpiSet, hour: number): number {
    const shift = this.slaughtering(hour);
    const shedTrucks = this.trucks.filter((t) => t.stage === "shed").length;
    const starving = shift && shedTrucks === 0 && this.platformBirds < 400;
    const maxWaitH = Math.max(0, ...this.trucks.filter((t) => t.stage === "shed").map((t) => (this.simTime - (t.t.shedIn ?? this.simTime)) / HOUR));
    const sLive = Math.min(starving ? 0.2 : 1, clamp01((3.5 - maxWaitH) / 1.5), clamp01((1.3 - k.condemnPct) / 0.7));
    const sLine = shift ? clamp01((k.linePct / 100 - 0.5) / 0.42) : 1;
    const maxContam = Math.max(...this.lines.map((l) => l.contam));
    const sQuality = Math.min(clamp01((k.yield - 72) / 2.5), clamp01((0.06 - maxContam) / 0.04));
    const fill = this.ante / ANTE_CAPACITY;
    const maxT = Math.max(...this.tunnels.map((t) => t.temp));
    const sCold = Math.min(clamp01((1 - fill) / 0.4), clamp01((-26 - maxT) / 7));
    const sStorage = clamp01((98.5 - k.storagePct) / 8.5);
    const blockedDocks = this.loads.filter((l) => l.stage === "grossQueue" && l.blocked).length;
    const sDispatch = Math.min(clamp01(1 - k.heldLoads / 6), clamp01(1 - blockedDocks / 4));
    const mode = this.nfeMode();
    const sMode = mode === "normal" ? 1 : mode === "svc" ? 0.75 : mode === "down" ? 0.2 : 0;
    const sNfe = Math.min(sMode, clamp01((6 - k.nfeP95) / 3.5)) * (this.certDays() <= 15 ? 0.9 : 1);
    return 100 * (0.15 * sLive + 0.2 * sLine + 0.15 * sQuality + 0.15 * sCold + 0.1 * sStorage + 0.1 * sDispatch + 0.15 * sNfe);
  }

  private recordSpark(): void {
    this.lastSpark = this.simTime;
    const s = this.snap;
    if (!s) return;
    const push = (key: SparkKey, v: number) => {
      const arr = this.spark[key];
      arr.push(v);
      if (arr.length > SPARK_LEN) arr.shift();
    };
    push("health", s.kpi.health);
    push("birds", s.kpi.birdsToday);
    push("line", s.kpi.lineRate);
    push("yield", s.kpi.yield);
    push("condemn", s.kpi.condemnPct);
    push("storage", s.kpi.storagePct);
    push("finished", s.kpi.finishedT);
    push("shipped", s.kpi.shippedT);
    push("nfe", s.kpi.nfeP95);
  }

  // ------------------------------------------------------------ snapshot
  private forceSnapshot(): void {
    this.lastSnapReal = this.realNow;
    this.version++;
    this.snap = this.buildSnapshot();
    for (const fn of this.snapListeners) fn();
  }

  private buildSnapshot(): Snapshot {
    const now = this.simTime;
    // production-day hour (3–27): shift logic, overtime past midnight included
    const hour = prodParts(now).hour;
    const d = this.day;
    const held = this.heldLoads();
    const plan = this.linePlan(hour);
    const rate = this.lineRate();
    const kpi: KpiSet = {
      health: 0,
      birdsToday: d.birds,
      lineRate: rate,
      linePlan: plan,
      linePct: plan > 0 ? (100 * rate) / plan : 0,
      yield: this.yieldPct(),
      condemnPct: this.condemnPct(),
      partialPct: this.partialPct(),
      storagePct: this.storagePct(),
      storagePallets: this.storagePallets(),
      storageTemp: this.storageTemp,
      finishedT: d.finishedKg / 1000,
      boxesToday: d.boxes,
      shippedT: d.shippedKg / 1000,
      loadsToday: d.loads,
      exportPct: d.shippedKg > 0 ? (100 * d.exportKg) / d.shippedKg : 0,
      nfeP95: this.nfeP95(),
      sefaz: "",
      heldLoads: held.count,
    };
    kpi.health = this.health(kpi, hour);
    const mode = this.nfeMode();
    const sefaz = this.sefazStatus();
    kpi.sefaz =
      mode === "svc" ? "Contingência SVC-RS" : mode === "cert" ? "Rejeições cStat 281" : mode === "down" ? `SEFAZ-PR cStat ${sefaz.code}` : "SEFAZ-PR em operação";
    const shift = this.slaughtering(hour);
    const pcp = this.pcpView(hour);
    this.snapPcp = pcp;
    const kpiLevel: Snapshot["kpiLevel"] = {
      health: levelFor(kpi.health, 90, 75, true),
      birds: pcp.today.level,
      line: shift ? levelFor(kpi.linePct, 85, 70, true) : "neutral",
      yield: levelFor(kpi.yield, 73.5, 72.5, true),
      condemn: lossLevel(levelFor(kpi.condemnPct, 0.8, 1.5, false)),
      storage: levelFor(kpi.storagePct, 90, 95, false),
      nfe: mode === "normal" ? levelFor(kpi.nfeP95, 3, 6, false) : mode === "svc" ? "warning" : "critical",
    };
    const stages = this.stages(kpi, hour, pcp);
    const constraint = this.constraint(stages, kpi, hour);
    for (const s of stages) s.constraint = s.id === constraint.id;
    this.markPressure(stages, constraint.id);

    const bays: BayView[] = this.bays.map((id) => {
      const t = id ? this.trucks.find((x) => x.id === id) : undefined;
      if (!t) return { waitMin: 0, level: "neutral" };
      const w = (now - (t.t.shedIn ?? now)) / MIN;
      return { truckId: t.id, waitMin: w, level: levelFor(w, 120, 180, false) };
    });

    const lines: LineView[] = this.lines.map((ln) => ({
      rate: ln.rate,
      plan: shift ? LINE_NOMINAL : 0,
      contamination: ln.contam * 100,
      sifReduced: ln.sif,
      stopped: !shift ? this.shiftName(hour) : now < ln.microUntil ? "Microparada" : this.platformBirds < 50 ? "Falta de aves" : null,
    }));

    const mass: MassBalance = {
      liveKg: d.liveKg + d.doaKg,
      carcassKg: d.carcassKg,
      pawsKg: d.pawsKg,
      gibletsKg: d.gibletsKg,
      trimKg: d.trimKg,
      condemnedKg: d.condKg,
      doaKg: d.doaKg,
      inedibleKg: Math.max(0, d.liveKg - d.carcassKg - d.pawsKg - d.gibletsKg - d.trimKg - d.condKg),
      finishedKg: d.finishedKg,
    };

    const tunnels: TunnelView[] = this.tunnels.map((tn) => {
      const wip = tn.bins.reduce((s, b) => s + b.boxes, 0) + tn.ready;
      const accepting = tn.temp <= TUNNEL_MAX_LOAD_TEMP && !tn.blocked;
      return {
        temp: tn.temp,
        wip,
        util: wip / TUNNEL_CAPACITY,
        dwellH: tunnelDwellH(tn.temp),
        accepting,
        blocked: tn.blocked,
        level: tn.temp > TUNNEL_MAX_LOAD_TEMP ? "critical" : tn.blocked || tn.temp > -32 ? "warning" : "ok",
      };
    });

    const docks: DockView[] = this.docks.map((id, i) => {
      const l = id ? this.loads.find((x) => x.id === id) : undefined;
      if (!l) return { id: i + 1, progress: 0, state: "free" };
      return {
        id: i + 1,
        loadId: l.id,
        vehicle: l.vehicle,
        market: l.market,
        dest: l.dest,
        progress: l.loadedPallets / l.pallets,
        state: l.stage === "grossQueue" && l.blocked ? "blocked" : "loading",
      };
    });

    const yard = {
      waitingDock: this.loads.filter((l) => l.stage === "yardDock").length,
      waitingNfe: this.loads.filter((l) => l.stage === "yardNfe").length,
      outside: this.loads.filter((l) => l.stage === "tareQueue").length,
      used: this.yardSlots.filter(Boolean).length,
    };

    const nfeNodes = this.nfeNodes(mode);
    const pendingLoads = this.loads.filter((l) => l.t.gross !== undefined && l.nfeState !== "done").length;

    return {
      version: this.version,
      simTime: now,
      speed: this.speed,
      paused: this.paused,
      hour: clockParts(now).hour,
      prodDate: this.day.date,
      shift: this.shiftName(hour),
      kpi,
      kpiLevel,
      spark: this.spark ?? { health: [], birds: [], line: [], yield: [], condemn: [], storage: [], finished: [], shipped: [], nfe: [] },
      stages,
      constraint,
      bays,
      weighings: [...this.weighings],
      shedTemp: this.shedTemp,
      fansOk: this.scenarioK("heat") < 0.05,
      doaPct: this.doaPct(),
      lines,
      platformBirds: this.platformBirds,
      mass,
      partialCauses: Object.entries(d.causesP).map(([label, count]) => ({ label, count })),
      totalCauses: Object.entries(d.causesT).map(([label, count]) => ({ label, count })),
      ante: this.ante,
      anteUtil: this.ante / ANTE_CAPACITY,
      flows: {
        pack: this.packRate,
        tunnelIn: this.tunnelInRate,
        putaway: this.putawayRate,
        unloading: this.unloader?.stage === "unloading",
        picking: this.outRate,
      },
      tunnels,
      storageByProduct: PRODUCTS.map((p) => ({ id: p.id, pallets: this.storage[p.id] })),
      nfeMode: mode,
      sefazStatus: sefaz,
      certDays: this.certDays(),
      nfeFeed: this.nfeFeed.map((n) => this.nfeView(n)),
      nfeToday: {
        authorized: d.nfeAuth,
        rejected: d.nfeRej,
        svc: d.nfeSvc,
        pendingLoads,
        queue: this.nfes.filter((n) => n.state !== "authorized").length,
      },
      nfeNodes,
      ticketsDown: this.ticketsDown,
      docks,
      yard,
      expedition: this.expedition(),
      hourly: this.hourly.map((h) => ({ ...h, storagePct: h === this.hourNow ? this.storagePct() : h.storagePct })),
      loadsToday: this.loadRows(),
      problems: this.problems(),
      scenarios: SCENARIOS.map((s) => {
        const r = this.runs.get(s.id);
        return { id: s.id, phase: r ? r.phase : "off", k: r?.k ?? 0, elapsedMin: r?.elapsedMin ?? 0 };
      }),
      session: { ...this.session, incidents: [...this.session.incidents] },
      highlight: this.getHighlight(),
      pcp,
    };
  }

  private nfeView(n: Nfe): NfeView {
    return {
      number: n.number,
      key: n.key,
      loadId: n.loadId,
      dest: n.dest,
      cfop: n.cfop,
      valueBrl: n.valueBrl,
      cStat: n.cStat,
      xMotivo: n.xMotivo,
      tpEmis: n.tpEmis,
      latencyS: n.latencyS,
      t: n.authorizedAt ?? n.doneAt,
      state: n.state,
    };
  }

  private nfeNodes(mode: Snapshot["nfeMode"]): Record<string, Level> {
    const held = this.heldLoads().count;
    return {
      balPA: this.ticketsDown ? "critical" : "ok",
      erp: "ok",
      msg: mode === "cert" ? "critical" : mode === "down" ? "warning" : "ok",
      sefaz: mode === "down" || mode === "svc" ? "critical" : "ok",
      svc: mode === "svc" ? "warning" : "neutral",
      proto: mode === "normal" || mode === "svc" ? "ok" : "neutral",
      danfe: "ok",
      portaria: held >= 5 ? "critical" : held >= 2 ? "warning" : "ok",
      cert: mode === "cert" ? "critical" : this.certDays() <= 15 ? "warning" : "ok",
    };
  }

  private stages(k: KpiSet, hour: number, pcp: PcpView): StageView[] {
    const now = this.simTime;
    const shift = this.slaughtering(hour);
    const shed = this.trucks.filter((t) => t.stage === "shed");
    const waits = shed.map((t) => (now - (t.t.shedIn ?? now)) / MIN);
    const maxWait = waits.length ? Math.max(...waits) : 0;
    const starving = shift && shed.length === 0 && this.platformBirds < 400;
    const doa = this.doaPct();
    const scaleQ = this.trucks.filter((t) => t.stage === "scaleQueue").length + (this.fvIn?.blocked ? 1 : 0);
    const maxContam = Math.max(...this.lines.map((l) => l.contam)) * 100;
    const fill = this.ante / ANTE_CAPACITY;
    const tunnelWip = this.tunnels.reduce((s, tn) => s + tn.bins.reduce((a, b) => a + b.boxes, 0) + tn.ready, 0);
    const maxT = Math.max(...this.tunnels.map((t) => t.temp));
    const tunnelsBlocked = this.tunnels.filter((t) => t.blocked || t.temp > TUNNEL_MAX_LOAD_TEMP).length;
    const busyDocks = this.docks.filter(Boolean).length;
    const blockedDocks = this.loads.filter((l) => l.stage === "grossQueue" && l.blocked).length;
    const fgQ = this.loads.filter((l) => l.stage === "grossQueue").length;
    const yardUsed = this.yardSlots.filter(Boolean).length;
    const mode = this.nfeMode();
    const packRate = this.packRate;
    return [
      {
        id: "aves",
        label: "Aves vivas · galpão",
        value: `${shed.length} cam. · espera ${fmtInt(maxWait)} min`,
        util: shed.length / 14,
        level: worst(starving ? "critical" : "ok", levelFor(maxWait, 120, 180, false), levelFor(doa, 0.35, 0.7, false)),
        note: starving ? "Falta de aves na plataforma" : doa > 0.35 ? `DOA ${fmtPct(doa, 2)}` : undefined,
        constraint: false,
        pressure: false,
      },
      {
        id: "balFV",
        label: "Balança de frango vivo",
        value: scaleQ ? `fila ${scaleQ}` : "livre",
        util: Math.min(1, scaleQ / 4),
        level: levelFor(scaleQ, 2, 4, false),
        note: this.fvIn?.blocked ? "Caminhão preso: galpão cheio" : undefined,
        constraint: false,
        pressure: false,
      },
      {
        id: "linha",
        label: "Abate · linhas 1 e 2",
        value: shift ? `${fmtInt(k.lineRate)}/h · ${fmtInt(k.linePct)}%` : this.shiftName(hour),
        util: shift ? k.lineRate / (LINE_NOMINAL * LINES) : 0,
        level: shift ? levelFor(k.linePct, 85, 70, true) : "neutral",
        note: this.lines.some((l) => l.sif)
          ? "SIF reduziu a linha 2"
          : this.downFactor < 0.9 && shift
            ? "Reduzida pela antecâmara"
            : pcp.today.adherence !== null && pcp.today.deltaBirds < -3000 && pcp.today.adherence < 98
              ? `${fmtInt(-pcp.today.deltaBirds)} aves abaixo do plano`
              : this.shiftName(hour) === "Hora extra"
                ? "Hora extra aprovada pelo PCP"
                : undefined,
        constraint: false,
        pressure: false,
      },
      {
        id: "inspecao",
        label: "Inspeção SIF · condenas",
        value: `contam. ${fmtPct(maxContam, 1)} · parcial ${fmtPct(k.partialPct, 1)}`,
        util: Math.min(1, maxContam / 8),
        level: levelFor(maxContam, 3, 5, false),
        constraint: false,
        pressure: false,
      },
      {
        id: "embalagem",
        label: "Cortes e embalagem",
        value: `${fmtInt(packRate)} cx/h`,
        util: Math.min(1, packRate / 2100),
        level: "ok",
        constraint: false,
        pressure: false,
      },
      {
        id: "ante",
        label: "Antecâmara",
        value: `${fmtInt(fill * 100)}% · ${fmtInt(this.ante)} cx`,
        util: fill,
        level: levelFor(fill * 100, 60, 90, false),
        note:
          this.chilledHold > 1
            ? `+${fmtInt(this.chilledHold)} cx em resfriados`
            : this.anteRate > 60 && fill > 0.3
              ? `lota em ~${fmtDuration(((ANTE_CAPACITY - this.ante) / this.anteRate) * 60)}`
              : undefined,
        constraint: false,
        pressure: false,
      },
      {
        id: "tuneis",
        label: "Túneis de congelamento",
        value: `${fmtInt((100 * tunnelWip) / (TUNNEL_CAPACITY * TUNNELS))}% · máx ${fmtDec(maxT, 0)} °C`,
        util: tunnelWip / (TUNNEL_CAPACITY * TUNNELS),
        level: tunnelsBlocked >= 2 ? "critical" : tunnelsBlocked === 1 || maxT > -32 ? "warning" : "ok",
        note: tunnelsBlocked ? `${tunnelsBlocked} túnel(is) sem receber` : undefined,
        constraint: false,
        pressure: false,
      },
      {
        id: "camara",
        label: "Câmara fria",
        value: `${fmtDec(k.storagePct, 1)}% · ${fmtDec(this.storageTemp, 1)} °C`,
        util: k.storagePct / 100,
        level: levelFor(k.storagePct, 90, 95, false),
        note: k.storagePct > 96.5 ? "Armazenagem limitada" : undefined,
        constraint: false,
        pressure: false,
      },
      {
        id: "docas",
        label: "Docas e picking",
        value: `${busyDocks}/${DOCKS} ocupadas${blockedDocks ? ` · ${blockedDocks} presas` : ""}`,
        util: busyDocks / DOCKS,
        level: levelFor(blockedDocks, 1, 3, false),
        constraint: false,
        pressure: false,
      },
      {
        id: "balPA",
        label: "Balança de produto acabado",
        value: this.ticketsDown ? "sem integração" : fgQ ? `fila ${fgQ}` : "livre",
        util: Math.min(1, fgQ / 4),
        level: this.ticketsDown ? "critical" : levelFor(fgQ, 2, 4, false),
        note: this.manualMode ? "Digitação manual de tickets" : undefined,
        constraint: false,
        pressure: false,
      },
      {
        id: "nfe",
        label: "NF-e · SEFAZ-PR",
        value: mode === "normal" ? `p95 ${fmtDec(k.nfeP95, 1)} s` : mode === "svc" ? "contingência SVC-RS" : mode === "cert" ? "cStat 281" : `cStat ${this.sefazStatus().code}`,
        util: Math.min(1, k.nfeP95 / 6),
        level: mode === "normal" ? "ok" : mode === "svc" ? "warning" : "critical",
        note: this.certDays() <= 15 && mode === "normal" ? `certificado vence em ${this.certDays()} dias` : undefined,
        constraint: false,
        pressure: false,
      },
      {
        id: "portaria",
        label: "Pátio e portaria",
        value: `${yardUsed}/${YARD_SLOTS} vagas · ${k.heldLoads} retidas`,
        util: yardUsed / YARD_SLOTS,
        level: worst(levelFor(yardUsed, 7, 9, false), levelFor(k.heldLoads, 1, 4, false)),
        constraint: false,
        pressure: false,
      },
    ];
  }

  private constraint(stages: StageView[], k: KpiSet, hour: number): { id: StageId | null; text: string } {
    const by = (id: StageId) => stages.find((s) => s.id === id);
    const mode = this.nfeMode();
    if (this.ticketsDown)
      return {
        id: "balPA",
        text: this.manualMode ? "Tickets digitados à mão, um a cada 25 min: cargas pesadas aguardam faturamento" : "Tickets de pesagem não chegam ao ERP: cargas pesadas não são faturadas",
      };
    if (mode === "cert") return { id: "nfe", text: "Toda NF-e rejeitada (cStat 281): nenhuma carga sai da planta" };
    if (mode === "down") return { id: "nfe", text: "SEFAZ-PR indisponível: cargas aguardando autorização da NF-e" };
    const shift = this.slaughtering(hour);
    if (shift && k.linePct < 90) {
      if (this.lines.some((l) => l.sif)) return { id: "inspecao", text: "SIF reduziu a velocidade da linha 2 por contaminação" };
      const fill = this.ante / ANTE_CAPACITY;
      if (this.downFactor < 0.93 || fill > 0.6) {
        const storeLimited = this.freePositions() < 60;
        if (storeLimited)
          return { id: "camara", text: "Câmara fria sem posições livres: a armazenagem só acompanha as retiradas e a linha reduz" };
        return { id: "tuneis", text: "Capacidade de congelamento abaixo da produção: a linha reduz para não lotar a antecâmara" };
      }
      if (by("aves")?.level === "critical") return { id: "aves", text: "Falta de aves no galpão de espera: a linha para por falta de matéria-prima" };
    }
    if (by("aves")?.level === "critical") return { id: "aves", text: "Galpão de espera em condição crítica" };
    if (k.heldLoads >= 2) return { id: "portaria", text: "Cargas retidas no pátio aguardando documentação" };
    if (mode === "svc") return { id: "nfe", text: "Emitindo em contingência SVC-RS: fila drenando" };
    const tightest = [...stages].filter((s) => s.id !== "aves" && s.id !== "camara").sort((a, b) => b.util - a.util)[0];
    return {
      id: null,
      text: `Sem restrição ativa · elo mais carregado: ${tightest.label.toLowerCase()} (${fmtInt(tightest.util * 100)}%)`,
    };
  }

  /** Back-pressure: stages upstream of the constraint that are already affected. */
  private markPressure(stages: StageView[], id: StageId | null): void {
    if (!id) return;
    // Every upstream link already degraded feels it (buffers that were drained on purpose stay "ok").
    const idx = stages.findIndex((s) => s.id === id);
    for (let i = idx - 1; i >= 0; i--) {
      const s = stages[i];
      if (s.id === "inspecao") continue;
      if (s.level === "warning" || s.level === "critical") s.pressure = true;
    }
  }

  private expedition(): ExpeditionView {
    const d = this.day;
    const inTransit = this.recentLoads.filter((l) => l.market === "EXP" && l.t.portEta !== undefined && l.t.portEta > this.simTime).length;
    return {
      exportKg: d.exportKg,
      domesticKg: d.domesticKg,
      exportUsd: d.exportUsd,
      domesticBrl: d.domesticBrl,
      loads: d.loads,
      loadsExport: d.loadsExp,
      loadsDomestic: d.loadsMi,
      byCountry: COUNTRIES.map((c) => ({ code: c.code, name: c.name, kg: d.byCountry[c.code]?.kg ?? 0, usd: d.byCountry[c.code]?.usd ?? 0 })).filter(
        (c) => c.kg > 0,
      ),
      byUf: UFS.map((u) => ({ code: u.code, kg: d.byUf[u.code]?.kg ?? 0, brl: d.byUf[u.code]?.brl ?? 0 })).filter((u) => u.kg > 0),
      byProduct: PRODUCTS.map((p) => ({ id: p.id, label: p.label, kg: d.byProduct[p.id] ?? 0 })).filter((p) => p.kg > 0),
      producedByProduct: PRODUCTS.map((p) => ({ id: p.id, label: p.label, kg: d.produced[p.id] ?? 0 })),
      inTransit,
      cutoffRisk: this.cutoffRisk(),
      missedCutoff: d.missedCutoff,
    };
  }

  private loadStatus(l: Load): string {
    if (l.t.exit !== undefined) return l.market === "EXP" ? (l.t.portEta && l.t.portEta > this.simTime ? "A caminho do porto" : "No porto") : "Em rota";
    switch (l.stage) {
      case "road":
      case "tareQueue":
        return "Chegando";
      case "tare":
        return "Pesando (tara)";
      case "yardDock":
        return "Aguardando doca";
      case "toDock":
      case "loading":
        return `Carregando ${fmtInt((100 * l.loadedPallets) / l.pallets)}%`;
      case "grossQueue":
        return l.blocked ? "Presa na doca" : "Aguardando balança";
      case "toScale":
      case "gross":
        return l.blocked ? "Presa na balança" : "Pesando (bruto)";
      default:
        break;
    }
    switch (l.nfeState) {
      case "ticket":
        return "Ticket não integrado";
      case "manual":
        return "Digitação manual";
      case "erp":
        return "Faturando (ERP)";
      case "sefaz":
        return l.nfes.some((n) => n.state === "rejected") ? "NF-e rejeitada" : "Aguardando SEFAZ";
      case "danfe":
        return "DANFE / MDF-e";
      default:
        return "Portaria";
    }
  }

  private loadRows(): LoadRow[] {
    const start = this.day.start;
    return this.recentLoads
      .filter((l) => l.t.arrive >= start || l.t.exit === undefined || l.t.exit >= start)
      .slice(-80)
      .reverse()
      .map((l) => ({
        id: l.id,
        market: l.market === "EXP" ? "Exportação" : "Mercado interno",
        vehicle: VEHICLES[l.vehicle].label,
        dest: l.market === "EXP" ? l.destName : l.dest,
        customer: l.customer,
        products: l.products.map((p) => PRODUCT_BY_ID[p.id].label).join(", "),
        t: l.kg / 1000,
        valueBrl: l.valueBrl,
        nfes: l.nfes.length ? l.nfes.map((n) => pad(n.number, 6)).join(", ") : "—",
        status: this.loadStatus(l),
        arrive: l.t.arrive,
        exit: l.t.exit,
      }));
  }

  // ------------------------------------------------------------ Dynatrace Intelligence
  private impacts(id: ScenarioId, c: RunCounters, live: boolean): { label: string; value: string; note?: string }[] {
    const kg = LIVE_KG_MEAN;
    switch (id) {
      case "heat":
        return [
          { label: "Aves mortas a mais (DOA)", value: fmtInt(c.extraDoa) },
          { label: "Perda estimada", value: fmtBrl(c.extraDoa * kg * LIVE_BRL_KG) },
          ...(live ? [{ label: "Temperatura do galpão", value: `${fmtDec(this.shedTemp, 1)} °C` }] : []),
        ];
      case "evisc":
        return [
          { label: "Aves não abatidas (L2)", value: fmtInt(c.lostBirds), note: planNote(c.lostBirds) },
          { label: "Carcaças condenadas a mais", value: fmtInt(c.extraCond) },
          { label: "Rendimento mínimo", value: fmtPct(c.minYield, 1), note: `base ${fmtPct(73.9, 1)}` },
        ];
      case "tunnel": {
        const t2 = this.tunnels[1]?.temp ?? TUNNEL_SETPOINT;
        const fill = this.ante / ANTE_CAPACITY;
        const eta = this.anteRate > 30 && fill < 0.97 ? ((ANTE_CAPACITY - this.ante) / this.anteRate) * 60 : 0;
        return [
          { label: "Aves não abatidas", value: fmtInt(c.lostBirds), note: planNote(c.lostBirds) },
          ...(live
            ? [
                { label: "Túnel 2", value: `${fmtDec(t2, 0)} °C` },
                { label: "Antecâmara", value: fmtPct(fill * 100, 0), note: eta > 0 ? `lota em ~${fmtDuration(eta)}` : undefined },
              ]
            : []),
        ];
      }
      case "storage":
        return [
          { label: "Contêineres não retirados", value: fmtInt(28 + c.notTaken), note: "4 dias" },
          { label: "Aves não abatidas", value: fmtInt(c.lostBirds), note: planNote(c.lostBirds) },
          ...(live ? [{ label: "Câmara fria", value: fmtPct(this.storagePct(), 1) }] : []),
        ];
      case "fgscale":
        return [
          { label: "Cargas retidas (pico)", value: fmtInt(c.heldPeak) },
          { label: "Faturamento retido (pico)", value: fmtBrl(c.heldBrlPeak) },
          { label: "Tickets digitados", value: fmtInt(c.manual) },
        ];
      case "sefaz":
        return [
          { label: "Cargas retidas (pico)", value: fmtInt(c.heldPeak), note: fmtT(c.heldKgPeak, 0) },
          { label: "Faturamento retido (pico)", value: fmtBrl(c.heldBrlPeak) },
          { label: "NF-e em contingência", value: fmtInt(c.svc), note: "SVC-RS" },
          { label: "Contêineres em risco de cut-off", value: fmtInt(c.riskPeak) },
        ];
      case "cert":
        return [
          { label: "NF-e rejeitadas (cStat 281)", value: fmtInt(c.rejected) },
          { label: "Cargas retidas (pico)", value: fmtInt(c.heldPeak), note: fmtT(c.heldKgPeak, 0) },
          { label: "Faturamento retido (pico)", value: fmtBrl(c.heldBrlPeak) },
          { label: "Contêineres em risco de cut-off", value: fmtInt(c.riskPeak) },
        ];
      default:
        return [];
    }
  }

  private problems(): ProblemView[] {
    const out: ProblemView[] = [];
    for (const r of this.runs.values()) {
      if (!r.opened) continue;
      const def = r.def;
      out.push({
        id: `${def.id}-${r.startedSim}`,
        scenario: def.id,
        status: r.phase === "active" ? "Active" : "Resolved",
        severity: def.severity,
        title: def.title,
        rootCause: def.rootCause,
        action: def.action,
        explanation: def.explanation,
        start: fmtClock(r.startedSim),
        duration: r.phase === "active" ? `há ${fmtDuration(r.elapsedMin)}` : `${fmtDuration(r.elapsedMin)} · normalizando`,
        mttdMin: def.mttdMin,
        entities: def.entities,
        impacts: this.impacts(def.id, r.c, true),
      });
    }
    const pcp = this.snapPcp;
    const r0 = pcp?.recovery;
    if (pcp && r0 && r0.kind !== "none" && (r0.scope === "day" ? r0.dayGapBirds : pcp.month.gapBirds) > 0.25 * PLAN_RATE) {
      const r = r0;
      const day = r.scope === "day";
      const missing = day ? r.dayGapBirds : pcp.month.gapBirds;
      const lost = [...this.runs.values()].filter((x) => x.c.lostBirds > 0.05 * PLAN_RATE).map((x) => x.def.name.toLowerCase());
      out.push({
        id: "pcp-forecast",
        status: "Forecast",
        severity: "warning",
        title: day ? `Plano do PCP de hoje em risco: faltam ${fmtInt(missing)} aves` : `Meta do mês do PCP em risco: faltam ${fmtInt(missing)} aves`,
        rootCause: lost.length
          ? `Abate perdido hoje: ${lost.join(", ")}. Projeção com o realizado do mês e o calendário do PCP no ritmo planejado de ${fmtInt(PLAN_RATE)} aves/h.`
          : `Saldo acumulado do mês no calendário do PCP. Projeção com o realizado e o ritmo planejado de ${fmtInt(PLAN_RATE)} aves/h.`,
        action: `${r.title}. ${r.detail}`,
        explanation: `A Dynatrace Intelligence compara os eventos de abate de cada hora com o calendário diário do PCP e projeta o fechamento do ${
          day ? "dia" : "mês"
        }. O déficit de ${fmtInt(missing)} aves equivale a ${fmtH(missing / PLAN_RATE)} de abate. ${
          r.kind === "overtime-today"
            ? "Hora extra ainda hoje recupera o volume enquanto os lotes programados continuam chegando."
            : r.kind === "extra-day"
              ? "O volume passa do que a hora extra configurada cobre: o caminho é um dia extra de abate."
              : "O PCP distribui a recuperação nos próximos dias úteis."
        }`,
        start: "previsão",
        duration: day
          ? `fechamento do dia: ${fmtPct((100 * pcp.today.projectedBirds) / Math.max(1, pcp.today.planBirds), 1)} do plano`
          : `fechamento do mês: ${fmtPct((100 * pcp.month.projectedBirds) / Math.max(1, pcp.month.planBirds), 1)} da meta`,
        entities: [
          { id: "stage:linha", label: "Linhas de abate" },
          { id: "stage:aves", label: "Aves programadas" },
        ],
        impacts: [
          { label: day ? "Déficit do dia (projeção)" : "Déficit do mês", value: fmtInt(missing), note: `${fmtT(missing * PLAN_FIN_PER_BIRD, 0)} de produto` },
          { label: "Abate para recuperar", value: fmtH(quarterUp(missing / PLAN_RATE)) },
          { label: "Meta do mês", value: fmtPct((100 * pcp.month.projectedBirds) / Math.max(1, pcp.month.planBirds), 1), note: "projeção" },
        ],
        cta:
          r.kind === "overtime-today" || (r.suggestTodayH > 0 && r.kind !== "extra-day")
            ? { label: `Aprovar ${fmtH(r.suggestTodayH)} de hora extra hoje`, overtimeH: pcp.today.extraH + r.suggestTodayH }
            : { label: "Abrir o plano do PCP", route: "/plano" },
      });
    }
    if (!this.certRenewed && !this.certExpired) {
      out.push({
        id: "cert-forecast",
        status: "Forecast",
        severity: "warning",
        title: CERT_FORECAST.title,
        rootCause: CERT_FORECAST.rootCause,
        action: CERT_FORECAST.action,
        explanation: CERT_FORECAST.explanation,
        start: "previsão",
        duration: `vence em ${CERT_DAYS} dias`,
        entities: [
          { id: "cert", label: "Certificado A1" },
          { id: "node:msg", label: "Mensageria NF-e" },
        ],
        impacts: [{ label: "Dias até o vencimento", value: fmtInt(CERT_DAYS) }],
      });
    }
    for (const r of this.resolved) {
      out.push({
        id: `${r.def.id}-${r.startedSim}`,
        scenario: r.def.id,
        status: "Resolved",
        severity: r.def.severity,
        title: r.def.title,
        rootCause: r.def.rootCause,
        action: r.def.action,
        explanation: r.def.explanation,
        start: fmtClock(r.startedSim),
        duration: fmtDuration(r.durMin),
        mttdMin: r.def.mttdMin,
        entities: r.def.entities,
        impacts: this.impacts(r.def.id, r.c, false),
      });
    }
    return out;
  }
}
