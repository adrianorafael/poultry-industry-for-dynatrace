/**
 * Single palette for the app: monitoring status (green / yellow / red) plus the fictitious
 * "Poultry Industry" brand and the illustrated plant. No color is defined outside this file;
 * UI chrome uses Strato tokens.
 */

export const STATUS = {
  ok: "#22A652",
  warning: "#F5C400",
  critical: "#DC172A",
  neutral: "#8C939F",
} as const;

export const BRAND = {
  wine: "#8C1D2F",
  amber: "#F2A541",
  cream: "#FFF4DF",
  teal: "#0FA3B1",
} as const;

export type Level = "ok" | "warning" | "critical" | "neutral";

export const LEVEL_COLOR: Record<Level, string> = {
  ok: STATUS.ok,
  warning: STATUS.warning,
  critical: STATUS.critical,
  neutral: STATUS.neutral,
};

/** Readable text on top of each level's background. */
export const LEVEL_TEXT: Record<Level, string> = {
  ok: "#FFFFFF",
  warning: "#1B1B1B",
  critical: "#FFFFFF",
  neutral: "#FFFFFF",
};

export const LEVEL_LABEL: Record<Level, string> = {
  ok: "OK",
  warning: "Atenção",
  critical: "Crítico",
  neutral: "Neutro",
};

/** Product families (pallets in the cold store). Carries no status meaning. */
export const FAMILY_COLOR: Record<string, string> = {
  Inteiro: "#E8B04B",
  Cortes: "#D9785B",
  "Miúdos e patas": "#A6523D",
  Industrializados: "#6E8FB5",
};

/** Market colors (export vs domestic). Carries no status meaning. */
export const MARKET_COLOR = {
  EXP: "#2E6DB4",
  MI: "#E08A2E",
} as const;

/** PCP plan charts: plan vs actual, overtime and extra days. Carries no status meaning. */
export const PCP_COLOR = {
  plan: "#A3ACB8",
  actual: BRAND.wine,
  overtime: BRAND.amber,
  extra: BRAND.teal,
} as const;

export interface ScenePalette {
  ground: string;
  groundDetail: string;
  road: string;
  roadLine: string;
  building: string;
  buildingEdge: string;
  room: string;
  roomCold: string;
  label: string;
  labelDim: string;
  conveyor: string;
  truckCab: string;
  cage: string;
  reefer: string;
  container: string;
}

export const SCENE: Record<"light" | "dark", ScenePalette> = {
  light: {
    ground: "#DDE8D2",
    groundDetail: "#C3D8B3",
    road: "#5A6068",
    roadLine: "#E9EDF1",
    building: "#F4F6F8",
    buildingEdge: "#B8C0C8",
    room: "#FFFFFF",
    roomCold: "#E3F1FA",
    label: "#1E2A36",
    labelDim: "#5B6875",
    conveyor: "#9AA5AF",
    truckCab: "#E9EDF1",
    cage: "#E3C189",
    reefer: "#F7F8FA",
    container: "#C94F3D",
  },
  dark: {
    ground: "#18241B",
    groundDetail: "#22362A",
    road: "#30353B",
    roadLine: "#AEB6BE",
    building: "#232A31",
    buildingEdge: "#46515C",
    room: "#2B333C",
    roomCold: "#20364A",
    label: "#E6ECF2",
    labelDim: "#A3AEB9",
    conveyor: "#6E7A86",
    truckCab: "#C9D0D6",
    cage: "#B38E55",
    reefer: "#D5DADF",
    container: "#B04636",
  },
};

export function levelFor(value: number, warn: number, crit: number, higherIsBetter: boolean): Level {
  if (higherIsBetter) {
    if (value >= warn) return "ok";
    if (value >= crit) return "warning";
    return "critical";
  }
  if (value <= warn) return "ok";
  if (value <= crit) return "warning";
  return "critical";
}

export function worst(...levels: Level[]): Level {
  if (levels.includes("critical")) return "critical";
  if (levels.includes("warning")) return "warning";
  if (levels.includes("ok")) return "ok";
  return "neutral";
}
