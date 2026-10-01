/** pt-BR number formatting ("1.234,5"). */
const NF = new Map<string, Intl.NumberFormat>();

function nf(min: number, max: number, currency?: "BRL" | "USD"): Intl.NumberFormat {
  const key = `${min}-${max}-${currency ?? ""}`;
  let f = NF.get(key);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      ...(currency ? { style: "currency", currency } : {}),
    });
    NF.set(key, f);
  }
  return f;
}

export const fmtInt = (v: number) => nf(0, 0).format(Math.round(v));
export const fmtDec = (v: number, d = 1) => nf(d, d).format(v);
export const fmtPct = (v: number, d = 1) => `${fmtDec(v, d)}%`;

/** Tons from kilograms: "585,2 t". */
export const fmtT = (kg: number, d = 1) => `${fmtDec(kg / 1000, d)} t`;

/** Compact reais: "R$ 6,1 mi", "R$ 245 mil". */
export function fmtBrl(v: number): string {
  if (Math.abs(v) >= 1e6) return `R$ ${fmtDec(v / 1e6, 1)} mi`;
  if (Math.abs(v) >= 1e4) return `R$ ${fmtInt(v / 1e3)} mil`;
  return nf(0, 0, "BRL").format(v);
}

/** Compact dollars: "US$ 1,2 mi", "US$ 48 mil". */
export function fmtUsd(v: number): string {
  if (Math.abs(v) >= 1e6) return `US$ ${fmtDec(v / 1e6, 1)} mi`;
  if (Math.abs(v) >= 1e4) return `US$ ${fmtInt(v / 1e3)} mil`;
  return `US$ ${fmtInt(v)}`;
}

export const fmtBrlFull = (v: number) => nf(2, 2, "BRL").format(v);

export function fmtSeconds(s: number): string {
  if (s >= 120) return `${fmtInt(s / 60)} min`;
  return `${fmtDec(s, 1)} s`;
}

export const fmtKg = (kg: number) => `${fmtInt(kg)} kg`;
