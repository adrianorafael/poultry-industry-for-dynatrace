import type { Level } from "../theme/colors";
import type { ProductId, Vehicle } from "./model";
import type { ScenarioId } from "./scenarios";

// ---------------------------------------------------------------- live birds
export type TruckStage =
  | "road"
  | "scaleQueue"
  | "scaleIn"
  | "toShed"
  | "shed"
  | "toPlatform"
  | "unloading"
  | "toScaleOut"
  | "scaleOut"
  | "leaving"
  | "gone";

export interface LiveTruck {
  id: string;
  n: number;
  farm: string;
  km: number;
  gta: string;
  /** Birds loaded at the farm (alive + dead). */
  birds: number;
  /** Birds still in the truck (during unloading). */
  birdsLeft: number;
  /** Dead birds (transport + waiting), fractional while accumulating. */
  doa: number;
  kgPerBird: number;
  tareKg: number;
  grossKg?: number;
  tareMeasuredKg?: number;
  netKg?: number;
  stage: TruckStage;
  stageStart: number;
  stageEnd: number;
  bay: number;
  /** Queue position (scale queue) — used by the scene. */
  slot: number;
  /** Stuck on the scale because the holding shed is full. */
  blocked: boolean;
  t: {
    loaded: number;
    arrive: number;
    scaleIn?: number;
    shedIn?: number;
    unloadStart?: number;
    unloadEnd?: number;
    scaleOut?: number;
    exit?: number;
  };
}

export interface Weighing {
  id: string;
  truckId: string;
  farm: string;
  kind: "bruto" | "tara";
  t: number;
  birds: number;
  grossKg: number;
  tareKg?: number;
  netKg?: number;
  kgPerBird?: number;
  waitMin?: number;
  doa?: number;
}

// ---------------------------------------------------------------- expedition
export type LoadStage =
  | "road"
  | "tareQueue"
  | "tare"
  | "yardDock"
  | "toDock"
  | "loading"
  | "grossQueue"
  | "toScale"
  | "gross"
  | "yardNfe"
  | "gate"
  | "leaving"
  | "gone";

export type NfeState = "none" | "ticket" | "manual" | "erp" | "sefaz" | "danfe" | "done";

export interface Nfe {
  number: number;
  key: string;
  loadId: string;
  cfop: string;
  dest: string;
  valueBrl: number;
  tpEmis: 1 | 7;
  cStat: number;
  xMotivo: string;
  requestedAt: number;
  doneAt: number;
  authorizedAt?: number;
  latencyS?: number;
  protocol?: string;
  attempts: number;
  state: "queued" | "sent" | "authorized" | "retry" | "rejected";
}

export interface Load {
  id: string;
  n: number;
  market: "EXP" | "MI";
  vehicle: Vehicle;
  dest: string;
  destName: string;
  customer: string;
  port?: string;
  products: { id: ProductId; pallets: number }[];
  pallets: number;
  kg: number;
  valueBrl: number;
  valueUsd: number;
  nfes: Nfe[];
  stage: LoadStage;
  stageStart: number;
  stageEnd: number;
  dock: number;
  /** Yard slot or queue position — used by the scene. */
  slot: number;
  loadedPallets: number;
  /** Waiting on the scale or at the dock because the next place is not available. */
  blocked: boolean;
  nfeState: NfeState;
  nfeStateAt: number;
  ticketIntegrated: boolean;
  divergencePct: number;
  cutoff: number;
  /** Earliest time the vehicle may go to a dock (appointment window). */
  dockAfter: number;
  t: {
    arrive: number;
    tare?: number;
    dockIn?: number;
    loaded?: number;
    gross?: number;
    invoiceStart?: number;
    authorized?: number;
    exit?: number;
    portEta?: number;
  };
}

// ---------------------------------------------------------------- views
export interface KpiSet {
  health: number;
  birdsToday: number;
  lineRate: number;
  linePlan: number;
  linePct: number;
  yield: number;
  condemnPct: number;
  partialPct: number;
  storagePct: number;
  storagePallets: number;
  storageTemp: number;
  finishedT: number;
  boxesToday: number;
  shippedT: number;
  loadsToday: number;
  exportPct: number;
  nfeP95: number;
  sefaz: string;
  heldLoads: number;
}

export type SparkKey = "health" | "birds" | "line" | "yield" | "condemn" | "storage" | "finished" | "shipped" | "nfe";

export type StageId =
  | "aves"
  | "balFV"
  | "linha"
  | "inspecao"
  | "embalagem"
  | "ante"
  | "tuneis"
  | "camara"
  | "docas"
  | "balPA"
  | "nfe"
  | "portaria";

export interface StageView {
  id: StageId;
  label: string;
  value: string;
  util: number;
  level: Level;
  note?: string;
  constraint: boolean;
  pressure: boolean;
}

export interface BayView {
  truckId?: string;
  waitMin: number;
  level: Level;
}

export interface LineView {
  rate: number;
  plan: number;
  contamination: number;
  sifReduced: boolean;
  stopped: string | null;
}

export interface TunnelView {
  temp: number;
  wip: number;
  util: number;
  dwellH: number;
  accepting: boolean;
  blocked: boolean;
  level: Level;
}

export interface MassBalance {
  liveKg: number;
  carcassKg: number;
  pawsKg: number;
  gibletsKg: number;
  trimKg: number;
  condemnedKg: number;
  doaKg: number;
  inedibleKg: number;
  finishedKg: number;
}

export interface NfeView {
  number: number;
  key: string;
  loadId: string;
  dest: string;
  cfop: string;
  valueBrl: number;
  cStat: number;
  xMotivo: string;
  tpEmis: 1 | 7;
  latencyS?: number;
  t: number;
  state: Nfe["state"];
}

export interface DockView {
  id: number;
  loadId?: string;
  vehicle?: Vehicle;
  market?: "EXP" | "MI";
  dest?: string;
  progress: number;
  state: "free" | "loading" | "blocked";
}

export interface LoadRow {
  id: string;
  market: "Exportação" | "Mercado interno";
  vehicle: string;
  dest: string;
  customer: string;
  products: string;
  t: number;
  valueBrl: number;
  nfes: string;
  status: string;
  arrive: number;
  exit?: number;
}

export interface ExpeditionView {
  exportKg: number;
  domesticKg: number;
  exportUsd: number;
  domesticBrl: number;
  loads: number;
  loadsExport: number;
  loadsDomestic: number;
  byCountry: { code: string; name: string; kg: number; usd: number }[];
  byUf: { code: string; kg: number; brl: number }[];
  byProduct: { id: ProductId; label: string; kg: number }[];
  producedByProduct: { id: ProductId; label: string; kg: number }[];
  inTransit: number;
  cutoffRisk: number;
  missedCutoff: number;
}

export interface HourlyPoint {
  start: number;
  producedKg: number;
  shippedKg: number;
  storagePct: number;
  birds: number;
}

export interface ProblemView {
  id: string;
  scenario?: ScenarioId;
  status: "Active" | "Forecast" | "Resolved";
  severity: "critical" | "warning" | "info";
  title: string;
  rootCause: string;
  action: string;
  explanation: string;
  start: string;
  duration: string;
  mttdMin?: number;
  entities: { id: string; label: string }[];
  impacts: { label: string; value: string; note?: string }[];
  /** One-click follow-up: approve overtime (new total hours for today) or open a route. */
  cta?: { label: string; overtimeH?: number; route?: string };
}

export interface ScenarioState {
  id: ScenarioId;
  phase: "off" | "active" | "recovering";
  k: number;
  elapsedMin: number;
}

export interface SessionStats {
  birds: number;
  finishedKg: number;
  shippedKg: number;
  nfes: number;
  incidents: { name: string; mttdMin: number; impact: string }[];
  start: number;
}

export interface Snapshot {
  version: number;
  simTime: number;
  speed: number;
  paused: boolean;
  /** Clock hour (0–24). */
  hour: number;
  /** Local midnight of the production date (the production day runs 03:00 to 03:00). */
  prodDate: number;
  shift: string;
  kpi: KpiSet;
  kpiLevel: Record<"health" | "birds" | "line" | "yield" | "condemn" | "storage" | "nfe", Level>;
  spark: Record<SparkKey, number[]>;
  stages: StageView[];
  constraint: { id: StageId | null; text: string };
  bays: BayView[];
  weighings: Weighing[];
  shedTemp: number;
  fansOk: boolean;
  doaPct: number;
  lines: LineView[];
  platformBirds: number;
  mass: MassBalance;
  partialCauses: { label: string; count: number }[];
  totalCauses: { label: string; count: number }[];
  ante: number;
  anteUtil: number;
  /** Flow rates for the animation (boxes/h) and whether a truck is unloading birds. */
  flows: { pack: number; tunnelIn: number; putaway: number; unloading: boolean; picking: number };
  tunnels: TunnelView[];
  storageByProduct: { id: ProductId; pallets: number }[];
  nfeMode: "normal" | "down" | "svc" | "cert";
  sefazStatus: { code: number; text: string };
  certDays: number;
  nfeFeed: NfeView[];
  nfeToday: { authorized: number; rejected: number; svc: number; pendingLoads: number; queue: number };
  nfeNodes: Record<string, Level>;
  ticketsDown: boolean;
  docks: DockView[];
  yard: { waitingDock: number; waitingNfe: number; outside: number; used: number };
  expedition: ExpeditionView;
  hourly: HourlyPoint[];
  loadsToday: LoadRow[];
  problems: ProblemView[];
  scenarios: ScenarioState[];
  session: SessionStats;
  highlight: string | null;
  pcp: PcpView;
}

export interface EngineEvents {
  weighed: Weighing;
  nfeSent: Nfe;
  nfeResult: Nfe;
  shipped: Load;
}

// ---------------------------------------------------------------- PCP
export type PcpDayKind = "util" | "sabado" | "domingo" | "feriado";

export interface PcpDayView {
  date: number;
  dom: number;
  dow: number;
  kind: PcpDayKind;
  holiday?: string;
  /** Regular plan (0 on days without slaughter planned). */
  planBirds: number;
  planKg: number;
  /** Extra slaughter day (Saturday, Sunday or holiday) and its plan. */
  extraDay: boolean;
  extraPlanBirds: number;
  extraPlanKg: number;
  /** Approved overtime (hours). */
  extraH: number;
  actualBirds: number | null;
  actualKg: number | null;
  cause?: string;
  when: "past" | "today" | "future";
  /** Actual / plan of the day, when there is a plan and an actual. */
  adherence: number | null;
  level: Level;
}

export type RecoveryKind = "none" | "overtime-today" | "overtime-days" | "extra-day" | "unrecoverable";

/** PCP settings: labor rules belong to HR, the plan accepts what is configured here. */
export interface PcpConfig {
  /** Overtime limit per day (hours); null = up to the end of the production day (03:00). */
  overtimeMaxH: number | null;
  /** Shifts in an extra slaughter day. */
  extraDayShifts: 1 | 2;
}

export interface PcpRecovery {
  kind: RecoveryKind;
  /** What drives the recommendation: closing today's plan or the month goal. */
  scope: "day" | "month";
  /** Birds missing to close today's plan (projection; positive = behind). */
  dayGapBirds: number;
  /** Slaughter hours needed to close the month (at the planning rate). */
  hours: number;
  title: string;
  detail: string;
  /** Overtime that can still be approved today (hours, quarter-hour steps). */
  overtimeToday: number;
  /** Suggested overtime for today (hours). */
  suggestTodayH: number;
  /** Next day without slaughter planned (Saturday first) that can host an extra day, if any. */
  extraDay?: number;
  extraScheduled: number[];
}

export interface PcpView {
  monthLabel: string;
  prodDate: number;
  today: {
    kind: PcpDayKind;
    extraDay: boolean;
    planBirds: number;
    planKg: number;
    planBirdsToNow: number;
    planKgToNow: number;
    actualBirds: number;
    actualKg: number;
    /** Actual ÷ plan to now (birds), null before the first shift. */
    adherence: number | null;
    kgAdherence: number | null;
    /** Birds behind (−) or ahead (+) of the plan to now. */
    deltaBirds: number;
    /** Expected birds at the end of the production day if the line runs at the planning rate. */
    projectedBirds: number;
    extraH: number;
    /** Local hour the slaughter ends today (with approved overtime). */
    endHour: number;
    level: Level;
  };
  month: {
    planBirds: number;
    planKg: number;
    planToDateBirds: number;
    actualBirds: number;
    actualKg: number;
    adherence: number;
    projectedBirds: number;
    /** Birds missing at the end of the month (positive = behind). */
    gapBirds: number;
    gapKg: number;
    workdays: number;
    workdaysLeft: number;
    extraHours: number;
    extraDays: number;
    level: Level;
  };
  previous: { label: string; planBirds: number; actualBirds: number; adherence: number; extraHours: number; extraDays: number };
  recovery: PcpRecovery;
  config: PcpConfig;
  /** Overtime limit that applies today (configured, bounded by the end of the production day). */
  overtimeCapH: number;
  /** Hours and birds of the extra day as configured. */
  extraDayH: number;
  extraDayBirds: number;
  days: PcpDayView[];
  /** Today's production day by local hour: plan and actual birds. */
  hourly: { hour: number; plan: number; actual: number | null }[];
}
