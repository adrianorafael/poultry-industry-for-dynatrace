/**
 * Plant model: the fictitious "Poultry Industry" slaughterhouse, Unit PR-01 (Paraná, Brazil).
 * Numbers are rounded industry references documented in specs/poultry-industry.md.
 */

export const PLANT_ID = "PR-01";
export const PLANT_NAME = "Frigorífico de aves";

// ---------------------------------------------------------------- slaughter lines
export const LINES = 2;
/** Nominal speed of each line (birds per hour). */
export const LINE_NOMINAL = 7500;
/** Line speed the SIF allows on a line with high contamination. */
export const LINE_SIF_REDUCED = 5000;
/** Slaughter windows in local hours: shift 1 and shift 2 (sanitation in between the days). */
export const SHIFTS: readonly [number, number][] = [
  [5, 13.8],
  [14.5, 23.3],
];
/** Mean micro-stop interval per running line (minutes) and duration range. */
export const MICROSTOP_EVERY_MIN = 150;
export const MICROSTOP_MIN: [number, number] = [2, 7];

// ---------------------------------------------------------------- live birds
export const BIRDS_PER_TRUCK = 4200;
export const LIVE_KG_MEAN = 2.85;
export const TRUCK_TARE_KG = 16500;
export const SHED_BAYS = 14;
/** Target stock in the holding shed (trucks) while slaughter is running. */
export const SHED_TARGET = 5;
/** Receiving window for live birds (local hours). */
export const RECEIVING: [number, number] = [3.4, 22.5];
/** Unloading rate into the hanging platform (birds/h) and platform buffer (birds). */
export const UNLOAD_RATE = 24000;
export const PLATFORM_BUFFER = 2500;
/** Dead on arrival (transport) and extra mortality per hour waiting in the shed, in normal weather. */
export const DOA_TRANSPORT = 0.0013;
export const DOA_SHED_PER_H = 0.0003;
/** Live weight shrink per hour waiting. */
export const SHRINK_PER_H = 0.0025;
export const SCALE_IN_MIN = 3;
export const SCALE_OUT_MIN = 2;

// ---------------------------------------------------------------- processing and yield
/** Slaughter → packed box (chilling, cut-up, packaging), minutes. */
export const PROCESS_DELAY_MIN = 90;
/** Gross chilled carcass yield over live weight, before partial-condemnation trimming. */
export const CARCASS_GROSS = 0.7455;
export const PAWS = 0.039;
export const GIBLETS = 0.037;
export const PROCESS_LOSS = 0.015;
export const CONTAM_BASE = 0.012;
export const PARTIAL_BASE = 0.08;
export const TOTAL_BASE = 0.003;
/** Share of carcass weight removed from a partially condemned carcass. */
export const TRIM_SHARE = 0.11;
export const BOX_KG = 18;

export const PARTIAL_CAUSES = [
  { id: "aero", label: "Aerossaculite", w: 0.38 },
  { id: "contam", label: "Contaminação (fecal/biliar)", w: 0.22 },
  { id: "contusao", label: "Contusão / fratura", w: 0.18 },
  { id: "dermatose", label: "Dermatose", w: 0.12 },
  { id: "outras", label: "Outras", w: 0.1 },
] as const;

export const TOTAL_CAUSES = [
  { id: "repugnante", label: "Aspecto repugnante", w: 0.26 },
  { id: "escaldagem", label: "Escaldagem excessiva", w: 0.22 },
  { id: "caquexia", label: "Caquexia", w: 0.2 },
  { id: "sangria", label: "Sangria inadequada", w: 0.12 },
  { id: "contam", label: "Contaminação", w: 0.11 },
  { id: "ascite", label: "Ascite", w: 0.06 },
  { id: "dermatose", label: "Dermatose", w: 0.03 },
] as const;

// ---------------------------------------------------------------- cold chain
export const ANTE_CAPACITY = 1200;
export const TUNNELS = 3;
export const TUNNEL_CAPACITY = 13000;
export const TUNNEL_SETPOINT = -35;
/** Hours in the tunnel at the setpoint until the product core reaches −18 °C. */
export const TUNNEL_DWELL_H = 18;
/** A tunnel above this temperature does not receive new product (quality rule). */
export const TUNNEL_MAX_LOAD_TEMP = -28;
export const BOXES_PER_PALLET = 56;
export const STORAGE_PALLETS = 12000;
export const STORAGE_SETPOINT = -22;
export const STORAGE_TARGET = 0.8;
/** Put-away capacity (pallets/h, forklifts). */
export const PUTAWAY_RATE = 150;
/** Practical maximum occupancy: above it there is no free position of the right type. */
export const STORAGE_PRACTICAL_MAX = 0.985;

export function tunnelDwellH(tempC: number): number {
  return TUNNEL_DWELL_H * (1 + 0.06 * Math.max(0, tempC - TUNNEL_SETPOINT));
}

// ---------------------------------------------------------------- products
export type ProductId =
  | "inteiro"
  | "peito"
  | "coxa"
  | "sobrecoxa"
  | "asa"
  | "coracao"
  | "miudos"
  | "patas"
  | "salsicha"
  | "passarinho"
  | "empanados";

export interface Product {
  id: ProductId;
  label: string;
  family: "Inteiro" | "Cortes" | "Miúdos e patas" | "Industrializados";
  /** Share of the finished-product weight. */
  mix: number;
  /** Illustrative prices: R$/t domestic and US$/t export (FOB). */
  brlT: number;
  usdT: number;
}

export const PRODUCTS: readonly Product[] = [
  { id: "inteiro", label: "Frango inteiro", family: "Inteiro", mix: 0.22, brlT: 8900, usdT: 1650 },
  { id: "peito", label: "Peito / filé", family: "Cortes", mix: 0.2, brlT: 12500, usdT: 2100 },
  { id: "coxa", label: "Coxa", family: "Cortes", mix: 0.08, brlT: 9200, usdT: 1550 },
  { id: "sobrecoxa", label: "Sobrecoxa", family: "Cortes", mix: 0.1, brlT: 10400, usdT: 2300 },
  { id: "asa", label: "Asa", family: "Cortes", mix: 0.08, brlT: 13500, usdT: 2400 },
  { id: "coracao", label: "Coração", family: "Miúdos e patas", mix: 0.006, brlT: 18000, usdT: 2600 },
  { id: "miudos", label: "Miúdos (fígado, moela)", family: "Miúdos e patas", mix: 0.04, brlT: 6500, usdT: 1100 },
  { id: "patas", label: "Patas", family: "Miúdos e patas", mix: 0.046, brlT: 5000, usdT: 2700 },
  { id: "salsicha", label: "Salsicha", family: "Industrializados", mix: 0.09, brlT: 11000, usdT: 1900 },
  { id: "passarinho", label: "Frango a passarinho", family: "Industrializados", mix: 0.07, brlT: 13000, usdT: 2200 },
  { id: "empanados", label: "Empanados", family: "Industrializados", mix: 0.068, brlT: 21000, usdT: 3200 },
];

export const PRODUCT_BY_ID: Record<ProductId, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p])) as Record<ProductId, Product>;

/** Simulated exchange rate (R$ per US$). */
export const BRL_PER_USD = 5.4;

// ---------------------------------------------------------------- markets
/** Share of the loads (not of the weight) that are export containers. */
export const EXPORT_SHARE = 0.42;

export interface Country {
  code: string;
  name: string;
  share: number;
  /** Products this market typically buys (container loads are single-product). */
  products: ProductId[];
  port: string;
}

export const COUNTRIES: readonly Country[] = [
  { code: "AE", name: "Emirados Árabes", share: 0.17, products: ["inteiro", "peito", "coxa"], port: "Paranaguá" },
  { code: "JP", name: "Japão", share: 0.13, products: ["sobrecoxa", "peito", "empanados"], port: "Paranaguá" },
  { code: "SA", name: "Arábia Saudita", share: 0.12, products: ["inteiro", "coxa"], port: "Paranaguá" },
  { code: "CN", name: "China", share: 0.11, products: ["patas", "asa", "miudos"], port: "Paranaguá" },
  { code: "ZA", name: "África do Sul", share: 0.08, products: ["coxa", "miudos", "inteiro"], port: "Paranaguá" },
  { code: "MX", name: "México", share: 0.08, products: ["peito", "coxa", "sobrecoxa"], port: "Paranaguá" },
  { code: "PH", name: "Filipinas", share: 0.06, products: ["coxa", "miudos"], port: "Itajaí" },
  { code: "CL", name: "Chile", share: 0.05, products: ["peito", "sobrecoxa"], port: "Itajaí" },
  { code: "KR", name: "Coreia do Sul", share: 0.04, products: ["sobrecoxa", "asa"], port: "Paranaguá" },
  { code: "SG", name: "Singapura", share: 0.04, products: ["asa", "peito"], port: "Paranaguá" },
  { code: "GB", name: "Reino Unido", share: 0.04, products: ["empanados", "peito"], port: "Paranaguá" },
  { code: "NL", name: "Países Baixos", share: 0.03, products: ["empanados", "peito"], port: "Paranaguá" },
  { code: "QA", name: "Catar", share: 0.03, products: ["inteiro"], port: "Paranaguá" },
  { code: "KW", name: "Kuwait", share: 0.02, products: ["inteiro"], port: "Paranaguá" },
];

export interface Uf {
  code: string;
  share: number;
  /** Hours by road. */
  hours: number;
}

export const UFS: readonly Uf[] = [
  { code: "SP", share: 0.31, hours: 12 },
  { code: "PR", share: 0.18, hours: 5 },
  { code: "RJ", share: 0.11, hours: 18 },
  { code: "MG", share: 0.09, hours: 17 },
  { code: "SC", share: 0.07, hours: 7 },
  { code: "RS", share: 0.06, hours: 11 },
  { code: "BA", share: 0.05, hours: 34 },
  { code: "PE", share: 0.04, hours: 44 },
  { code: "GO", share: 0.04, hours: 16 },
  { code: "DF", share: 0.03, hours: 20 },
  { code: "MS", share: 0.02, hours: 10 },
];

/** Domestic loads: products a distributor orders (mixed truck). */
export const DOMESTIC_PRODUCTS: readonly ProductId[] = [
  "inteiro",
  "peito",
  "coxa",
  "sobrecoxa",
  "asa",
  "coracao",
  "miudos",
  "salsicha",
  "passarinho",
  "empanados",
];

export const CUSTOMER_KINDS = ["Rede varejista", "Atacadista", "Food service", "Distribuidor"] as const;

// ---------------------------------------------------------------- expedition
export type Vehicle = "container" | "carreta" | "truck" | "toco";

export const VEHICLES: Record<Vehicle, { label: string; pallets: number; loadMin: number }> = {
  container: { label: "Contêiner reefer 40'", pallets: 26, loadMin: 110 },
  carreta: { label: "Carreta frigorífica", pallets: 24, loadMin: 90 },
  truck: { label: "Truck frigorífico", pallets: 12, loadMin: 60 },
  toco: { label: "Toco frigorífico", pallets: 6, loadMin: 40 },
};

/** Domestic vehicle mix (share of domestic loads). */
export const DOMESTIC_VEHICLES: readonly { v: Vehicle; share: number }[] = [
  { v: "carreta", share: 0.3 },
  { v: "truck", share: 0.35 },
  { v: "toco", share: 0.35 },
];

export const DOCKS = 6;
export const YARD_SLOTS = 10;
export const FG_SCALE_MIN = 4;
export const ERP_INVOICE_MIN = 3;
export const DANFE_MIN = 2;
export const GATE_MIN = 2;
/** Expected loads per day (sum of the hourly profile). */
export const LOADS_PER_DAY = 34;
/** Vehicles arrive for an appointment and wait in the yard before their dock window (minutes). */
export const APPOINTMENT_WAIT_MIN: [number, number] = [15, 70];
/** Road time to the export port (hours). */
export const PORT_HOURS = 9;

/** Hourly dispatch profile (relative weight per local hour). */
export function dispatchWeight(hour: number): number {
  if (hour >= 5 && hour < 9) return 1.6;
  if (hour >= 9 && hour < 14) return 0.9;
  if (hour >= 14 && hour < 19) return 1.5;
  if (hour >= 19 && hour < 23) return 0.8;
  return 0.2;
}

export const DISPATCH_WEIGHT_SUM = Array.from({ length: 24 }, (_, h) => dispatchWeight(h + 0.5)).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- NF-e
export const NFE_SERIES = 1;
export const NFE_FIRST_NUMBER = 128450;
/** Authorization latency (s): log-normal median and sigma. */
export const NFE_MEDIAN_S = 0.9;
export const NFE_SIGMA = 0.45;
export const SVC_MEDIAN_S = 1.3;
/**
 * Minutes until SEFAZ-PR activates its contingency authorizer (SVC-RS). The SVC depends on the
 * origin SEFAZ activating it; EPEC is not accepted for Paraná issuers from 2026-10-05 (NT 2014.001 v1.40).
 */
export const SVC_ACTIVATION_MIN = 75;
export const CERT_DAYS = 12;
/** Price per live kg paid for lost birds (illustrative). */
export const LIVE_BRL_KG = 5.2;

export const SHED_TEMP_NORMAL = 26;

/** Is the slaughter running at this local hour? */
export function inShift(hour: number): boolean {
  return SHIFTS.some(([a, b]) => hour >= a && hour < b);
}

/** Remaining slaughter hours in the local day after `hour`. */
export function remainingShiftHours(hour: number): number {
  let h = 0;
  for (const [a, b] of SHIFTS) h += Math.max(0, b - Math.max(a, hour));
  return h;
}

export function shiftLabel(hour: number): string {
  if (hour >= SHIFTS[0][0] && hour < SHIFTS[0][1]) return "Turno 1";
  if (hour >= SHIFTS[1][0] && hour < SHIFTS[1][1]) return "Turno 2";
  if (hour >= SHIFTS[0][1] && hour < SHIFTS[1][0]) return "Troca de turno";
  return "Higienização";
}

// ---------------------------------------------------------------- PCP (production planning)
/**
 * The production day runs from 03:00 to 03:00: shift 2, its overtime and the boxes packed after
 * midnight belong to the day the slaughter started.
 */
export const PROD_DAY_START_H = 3;
/** Regular slaughter hours per day (both shifts). */
export const SHIFT_HOURS = SHIFTS.reduce((s, [a, b]) => s + b - a, 0);
/** Effective slaughter rate the PCP plans with: two lines at nominal speed, ~97% availability (birds/h). */
export const PLAN_RATE = 14500;
/** Birds per regular working day in the PCP calendar (both shifts at the planning rate, rounded). */
export const PLAN_BIRDS_DAY = 255000;
/** Planned finished product per bird (kg): average live weight of the lots × planned yield. */
export const PLAN_FIN_PER_BIRD = 2.25;
/** The production day ends here (03:00 of the next date): overtime cannot run past it. */
export const PROD_DAY_END_H = PROD_DAY_START_H + 24;
/**
 * Labor rules (overtime limits and pay) belong to the HR systems, not to this demo: the plan accepts
 * whatever the PCP configures. These are the defaults of the PCP settings on the plan page.
 */
export const PCP_DEFAULTS = {
  /** Overtime limit per day (hours); null = up to the end of the production day. */
  overtimeMaxH: null as number | null,
  /** Shifts in an extra slaughter day (Saturday, Sunday or holiday). */
  extraDayShifts: 1 as 1 | 2,
};
/** From this many hours to recover, the PCP prefers an extra slaughter day to overtime spread over the next days. */
export const PREFER_EXTRA_DAY_H = 6;
/** Overtime per day the PCP used in the synthetic history of the month. */
export const HISTORY_OVERTIME_H = 2;
/** One extra-day shift (hours) and the birds it slaughters at the planning rate. */
export const EXTRA_SHIFT_H = SHIFTS[0][1] - SHIFTS[0][0];
export const EXTRA_SHIFT_BIRDS = Math.round((EXTRA_SHIFT_H * PLAN_RATE) / 100) * 100;

/** Main causes of lost slaughter in the synthetic history of the month (illustrative). */
export const PLAN_LOSS_CAUSES = [
  "Compressor de amônia dos túneis",
  "SIF reduziu a linha 2 (contaminação)",
  "Câmara fria lotada (contêineres atrasados)",
  "Falta de aves (chuva na apanha)",
  "Quebra da nória da linha 1",
  "Queda de energia da concessionária",
] as const;

/** Causes of a major loss (most of a day without slaughter) in the synthetic history (illustrative). */
export const PLAN_MAJOR_CAUSES = ["Queda de energia da concessionária", "Falta de aves (estrada interditada)", "Vazamento de amônia na sala de máquinas"] as const;

/** Easter Sunday (anonymous Gregorian algorithm). */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** National holidays (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) plus Good Friday. State and municipal holidays are not modelled. */
export function holidayName(date: Date): string | undefined {
  const md = `${date.getMonth() + 1}-${date.getDate()}`;
  const fixed: Record<string, string> = {
    "1-1": "Confraternização Universal",
    "4-21": "Tiradentes",
    "5-1": "Dia do Trabalho",
    "9-7": "Independência",
    "10-12": "Nossa Senhora Aparecida",
    "11-2": "Finados",
    "11-15": "Proclamação da República",
    "11-20": "Consciência Negra",
    "12-25": "Natal",
  };
  if (fixed[md]) return fixed[md];
  const e = easter(date.getFullYear());
  const goodFriday = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 2);
  if (goodFriday.getMonth() === date.getMonth() && goodFriday.getDate() === date.getDate()) return "Sexta-feira Santa";
  return undefined;
}
