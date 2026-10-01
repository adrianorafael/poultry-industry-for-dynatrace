/** Plant layout (SVG units). Top row: live birds → slaughter → freezing. Bottom row: cold store → docks → yard → scale → gate. */

export const SCENE_W = 1600;
export const SCENE_H = 660;

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------- live birds
export const ROAD_IN_Y = 110;
export const ROAD_OUT_Y = 305;
export const FV_SCALE_IN: Pt = { x: 112, y: ROAD_IN_Y };
export const FV_SCALE_OUT: Pt = { x: 112, y: ROAD_OUT_Y };
export const SHED: Box = { x: 178, y: 40, w: 250, h: 245 };
export const PLATFORM: Pt = { x: 468, y: 162 };

export function bayPos(i: number): Pt {
  const col = i % 7;
  const row = Math.floor(i / 7);
  return { x: SHED.x + 20 + col * 34, y: row === 0 ? 103 : 222 };
}

export function inQueuePos(slot: number): Pt {
  return { x: 44 - slot * 64, y: ROAD_IN_Y };
}

export function outQueuePos(slot: number): Pt {
  return { x: 184 + slot * 64, y: ROAD_OUT_Y };
}

// ---------------------------------------------------------------- slaughter and processing
export const LINE_Y = [118, 196];
export const LINE_X0 = 500;
export const LINE_X1 = 1072;
export const SLAUGHTER: Box = { x: 494, y: 40, w: 584, h: 245 };

export const STATIONS: { id: string; label: string[]; x: number; w: number }[] = [
  { id: "stun", label: ["Insensibi-", "lização"], x: 512, w: 60 },
  { id: "bleed", label: ["Sangria"], x: 580, w: 70 },
  { id: "scald", label: ["Escalda-", "gem"], x: 658, w: 64 },
  { id: "pluck", label: ["Depena-", "gem"], x: 730, w: 64 },
  { id: "evisc", label: ["Eviscera-", "ção"], x: 802, w: 80 },
  { id: "sif", label: ["Inspeção", "SIF"], x: 890, w: 62 },
  { id: "chill", label: ["Pré-chiller", "e chiller"], x: 960, w: 106 },
];

export const RENDERING: Box = { x: 890, y: 294, w: 90, h: 26 };
export const CUTTING: Box = { x: 1086, y: 40, w: 176, h: 245 };
export const ANTE: Box = { x: 1272, y: 40, w: 70, h: 245 };
export const TUNNEL_BOX = (i: number): Box => ({ x: 1352, y: 44 + i * 78, w: 238, h: 66 });
export const MACHINES: Box = { x: 1352, y: 284, w: 238, h: 36 };

// ---------------------------------------------------------------- cold store and expedition
export const STORE: Box = { x: 912, y: 340, w: 678, h: 306 };
export const GRID = { cols: 25, rows: 8, x: STORE.x + 16, y: STORE.y + 36, cw: 26, ch: 32 };
export const DOCK_X = 912;

export function dockPos(i: number): Pt {
  return { x: DOCK_X - 50, y: 368 + i * 46 };
}

export const YARD: Box = { x: 430, y: 340, w: 330, h: 190 };

export function yardPos(i: number): Pt {
  const col = i % 5;
  const row = Math.floor(i / 5);
  return { x: YARD.x + 38 + col * 64, y: row === 0 ? 390 : 480 };
}

export const ROAD_Y = 596;
export const FG_SCALE: Pt = { x: 300, y: ROAD_Y };
export const GATE: Pt = { x: 150, y: ROAD_Y };
export const EXPORT_EXIT_Y = 640;

export function gateQueuePos(slot: number): Pt {
  return { x: 70 - slot * 88, y: ROAD_Y };
}

// ---------------------------------------------------------------- highlight targets
export const HIGHLIGHT: Record<string, Box> = {
  "stage:aves": SHED,
  "equip:V-04": { x: SHED.x + 150, y: SHED.y - 2, w: 96, h: 24 },
  "stage:balFV": { x: 64, y: 80, w: 96, h: 250 },
  "line:2": { x: LINE_X0 - 6, y: LINE_Y[1] - 14, w: LINE_X1 - LINE_X0 + 12, h: 28 },
  "stage:linha": { x: LINE_X0 - 6, y: LINE_Y[0] - 14, w: LINE_X1 - LINE_X0 + 12, h: LINE_Y[1] - LINE_Y[0] + 28 },
  "stage:inspecao": { x: 886, y: 58, w: 70, h: 190 },
  "equip:EVS-2": { x: 798, y: LINE_Y[1] - 18, w: 88, h: 36 },
  "stage:ante": ANTE,
  "stage:tuneis": { x: 1348, y: 40, w: 246, h: 240 },
  "tunnel:2": TUNNEL_BOX(1),
  "equip:C-3": { x: MACHINES.x + 90, y: MACHINES.y, w: 50, h: MACHINES.h },
  "stage:camara": STORE,
  port: { x: 0, y: EXPORT_EXIT_Y - 16, w: 250, h: 26 },
  "stage:docas": { x: DOCK_X - 120, y: 344, w: 128, h: 290 },
  "stage:balPA": { x: FG_SCALE.x - 50, y: ROAD_Y - 26, w: 100, h: 52 },
  "equip:GW-BAL-02": { x: FG_SCALE.x - 50, y: ROAD_Y - 58, w: 100, h: 30 },
  "stage:portaria": YARD,
  "stage:nfe": { x: GATE.x - 40, y: ROAD_Y - 78, w: 80, h: 100 },
  "node:sefaz": { x: GATE.x - 40, y: ROAD_Y - 78, w: 80, h: 100 },
  "node:svc": { x: GATE.x - 40, y: ROAD_Y - 78, w: 80, h: 100 },
  "node:msg": { x: GATE.x - 40, y: ROAD_Y - 78, w: 80, h: 100 },
  cert: { x: GATE.x - 40, y: ROAD_Y - 78, w: 80, h: 100 },
};
