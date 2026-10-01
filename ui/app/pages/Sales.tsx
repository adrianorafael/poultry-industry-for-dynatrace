import React, { useMemo, useState } from "react";
import { CategoricalBarChart, DonutChart, GaugeChart, TimeseriesChart, type Timeseries } from "@dynatrace/strato-components/charts";
import { ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components/tables";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { SourceTag } from "../components/SourceTag";
import { BOX_KG, BOXES_PER_PALLET, COUNTRIES, EXPORT_SHARE, LOADS_PER_DAY, PRODUCTS, UFS, VEHICLES } from "../sim/model";
import { fmtClock } from "../sim/time";
import type { LoadRow, Snapshot } from "../sim/types";
import { FAMILY_COLOR, MARKET_COLOR, STATUS } from "../theme/colors";
import { useApp, useSnapshot } from "../state/engine-context";
import { fmtBrl, fmtDec, fmtInt, fmtUsd } from "../format";

/** Reference day of the simulated plant, used to estimate the month to date (clearly labelled as an estimate). */
const PALLET_T = (BOXES_PER_PALLET * BOX_KG) / 1000;
const REF_EXPORT_T = LOADS_PER_DAY * EXPORT_SHARE * VEHICLES.container.pallets * PALLET_T;
const REF_DOMESTIC_T = LOADS_PER_DAY * (1 - EXPORT_SHARE) * (0.35 * 24 + 0.35 * 12 + 0.3 * 6) * PALLET_T;
const REF_USD_T = 2050;
const REF_BRL_T = 11000;

interface Totals {
  exportT: number;
  domesticT: number;
  exportUsd: number;
  domesticBrl: number;
  byCountry: { category: string; value: number }[];
  byUf: { category: string; value: number }[];
  byProduct: { produto: string; t: number }[];
}

function totals(snap: Snapshot, month: boolean): Totals {
  const e = snap.expedition;
  const days = month ? new Date(snap.prodDate).getDate() - 1 : 0;
  const byCountry = COUNTRIES.map((c) => ({
    category: c.name,
    value: (e.byCountry.find((x) => x.code === c.code)?.kg ?? 0) / 1000 + days * REF_EXPORT_T * c.share,
  })).filter((c) => c.value > 0);
  const byUf = UFS.map((u) => ({ category: u.code, value: (e.byUf.find((x) => x.code === u.code)?.kg ?? 0) / 1000 + days * REF_DOMESTIC_T * u.share })).filter(
    (u) => u.value > 0,
  );
  const byProduct = PRODUCTS.map((p) => ({
    produto: p.label,
    t: (e.byProduct.find((x) => x.id === p.id)?.kg ?? 0) / 1000 + days * (REF_EXPORT_T + REF_DOMESTIC_T) * p.mix,
  })).filter((p) => p.t > 0);
  return {
    exportT: e.exportKg / 1000 + days * REF_EXPORT_T,
    domesticT: e.domesticKg / 1000 + days * REF_DOMESTIC_T,
    exportUsd: e.exportUsd + days * REF_EXPORT_T * REF_USD_T,
    domesticBrl: e.domesticBrl + days * REF_DOMESTIC_T * REF_BRL_T,
    byCountry: byCountry.sort((a, b) => b.value - a.value),
    byUf: byUf.sort((a, b) => b.value - a.value),
    byProduct,
  };
}

const PRODUCT_COLORS: Record<string, string> = Object.fromEntries(PRODUCTS.map((p) => [p.label, FAMILY_COLOR[p.family]]));

const COLUMNS: DataTableColumnDef<LoadRow>[] = [
  { id: "id", header: "Carga", accessor: "id", width: 80 },
  { id: "market", header: "Mercado", accessor: "market", width: 130 },
  { id: "dest", header: "Destino", accessor: "dest", width: 130 },
  { id: "customer", header: "Cliente (fictício)", accessor: "customer", minWidth: 170 },
  { id: "vehicle", header: "Veículo", accessor: "vehicle", minWidth: 150 },
  { id: "products", header: "Produtos", accessor: "products", minWidth: 200 },
  { id: "t", header: "Peso (t)", accessor: "t", alignment: "right", width: 90, cell: ({ value }) => <span>{fmtDec(value as number, 1)}</span> },
  { id: "valueBrl", header: "Valor", accessor: "valueBrl", alignment: "right", width: 110, cell: ({ value }) => <span>{fmtBrl(value as number)}</span> },
  { id: "nfes", header: "NF-e", accessor: "nfes", minWidth: 120 },
  { id: "arrive", header: "Chegada", accessor: "arrive", width: 80, cell: ({ value }) => <span>{fmtClock(value as number)}</span> },
  { id: "status", header: "Situação", accessor: "status", minWidth: 150 },
];

export const Sales = () => {
  const snap = useSnapshot();
  const { prefs } = useApp();
  const [range, setRange] = useState<"dia" | "mes">("dia");
  const month = range === "mes";
  const T = totals(snap, month);
  const series = useMemo<Timeseries[]>(() => {
    // complete hours only: the current hour is still filling up
    const pts = snap.hourly.slice(0, -1);
    return [
      {
        name: "Produção",
        unit: "t",
        datapoints: pts.map((h) => ({ start: new Date(h.start), end: new Date(h.start + 3600_000), value: h.producedKg / 1000 })),
      },
      {
        name: "Expedição",
        unit: "t",
        datapoints: pts.map((h) => ({ start: new Date(h.start), end: new Date(h.start + 3600_000), value: h.shippedKg / 1000 })),
      },
    ];
    // refresh once per plant hour or when the last bucket grows noticeably
  }, [snap.hourly]);
  const split = [
    { mercado: "Exportação", t: T.exportT },
    { mercado: "Mercado interno", t: T.domesticT },
  ].filter((s) => s.t > 0);
  const tiles: [string, string, string][] = [
    ["Expedido", `${fmtDec(T.exportT + T.domesticT, month ? 0 : 1)} t`, month ? "estimativa do mês" : `${fmtInt(snap.expedition.loads)} cargas`],
    ["Exportação", `${fmtDec(T.exportT, month ? 0 : 1)} t`, fmtUsd(T.exportUsd)],
    ["Mercado interno", `${fmtDec(T.domesticT, month ? 0 : 1)} t`, fmtBrl(T.domesticBrl)],
    ["Faturamento total", fmtBrl(T.domesticBrl + T.exportUsd * 5.4), "câmbio simulado R$ 5,40"],
    ["NF-e autorizadas hoje", fmtInt(snap.nfeToday.authorized), `${fmtInt(snap.nfeToday.svc)} em contingência`],
    ["Contêineres a caminho do porto", fmtInt(snap.expedition.inTransit), `${fmtInt(snap.expedition.cutoffRisk)} em risco de cut-off`],
  ];
  return (
    <div className={`ff-sales ${prefs.tv ? "ff-tv" : ""}`}>
      <div className="ff-sales-head">
        <div>
          <Heading level={2}>Vendas e expedição</Heading>
          <Text className="ff-muted">
            Mercado interno por UF e exportação por país. “Mês até agora” soma os dias anteriores de um dia de referência da planta simulada (estimativa) ao
            dia de hoje.
          </Text>
        </div>
        <ToggleButtonGroup value={range} onChange={(v) => setRange(v as "dia" | "mes")} aria-label="Período">
          <ToggleButtonGroup.Item value="dia">Hoje</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="mes">Mês até agora</ToggleButtonGroup.Item>
        </ToggleButtonGroup>
      </div>

      <div className="ff-sales-tiles">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="ff-kpi ff-kpi-static">
            <span className="ff-kpi-label">{label}</span>
            <span className="ff-kpi-value">{value}</span>
            <span className="ff-kpi-sub">{sub}</span>
          </div>
        ))}
      </div>

      <div className="ff-sales-grid">
        <section className="ff-panel">
          <Heading level={6} as="h2">
            Exportação por país (t)
          </Heading>
          {T.byCountry.length ? (
            <CategoricalBarChart data={T.byCountry} layout="horizontal" height={300} colorPalette={[MARKET_COLOR.EXP]}>
              <CategoricalBarChart.Legend hidden />
              <CategoricalBarChart.ValueAxis formatter={(v: number) => `${fmtInt(v)} t`} />
            </CategoricalBarChart>
          ) : (
            <div className="ff-empty">Sem exportação registrada ainda hoje.</div>
          )}
          <SourceTag text="poultry.load.released com market = EXP, agrupado por país; valor FOB em US$ do pedido no ERP" />
        </section>
        <section className="ff-panel">
          <Heading level={6} as="h2">
            Mercado interno por UF (t)
          </Heading>
          {T.byUf.length ? (
            <CategoricalBarChart data={T.byUf} layout="vertical" height={300} colorPalette={[MARKET_COLOR.MI]}>
              <CategoricalBarChart.Legend hidden />
              <CategoricalBarChart.ValueAxis formatter={(v: number) => `${fmtInt(v)} t`} />
            </CategoricalBarChart>
          ) : (
            <div className="ff-empty">Sem expedição para o mercado interno ainda hoje.</div>
          )}
          <SourceTag text="poultry.load.released com market = MI, agrupado pela UF do destinatário" />
        </section>
        <section className="ff-panel">
          <Heading level={6} as="h2">
            Exportação × mercado interno (t)
          </Heading>
          {split.length ? (
            <DonutChart
              data={split}
              labelAccessor="mercado"
              valueAccessor="t"
              height={300}
              colorPalette={{ Exportação: MARKET_COLOR.EXP, "Mercado interno": MARKET_COLOR.MI }}
              formatter={(v: number) => `${fmtInt(v)} t`}
            />
          ) : (
            <div className="ff-empty">Sem expedição registrada ainda hoje.</div>
          )}
        </section>
      </div>

      <div className="ff-sales-grid ff-sales-grid-2">
        <section className="ff-panel">
          <Heading level={6} as="h2">
            Produção × expedição por hora — últimas 24 h de planta (t)
          </Heading>
          <TimeseriesChart data={series} height={260} colorPalette={{ Produção: FAMILY_COLOR.Cortes, Expedição: MARKET_COLOR.EXP }} />
          <SourceTag text="poultry.box.packed e poultry.load.released somados por hora (makeTimeseries)" />
        </section>
        <section className="ff-panel">
          <Heading level={6} as="h2">
            Ocupação da câmara fria
          </Heading>
          <GaugeChart value={snap.kpi.storagePct} min={0} max={100} unit="%" height={220} color={snap.kpi.storagePct >= 95 ? STATUS.critical : snap.kpi.storagePct >= 90 ? STATUS.warning : STATUS.ok}>
            <GaugeChart.ThresholdIndicator value={90} color={STATUS.warning} />
            <GaugeChart.ThresholdIndicator value={95} color={STATUS.critical} />
          </GaugeChart>
          <Paragraph className="ff-muted">
            {fmtInt(snap.kpi.storagePallets)} de 12.000 posições · {fmtDec(snap.kpi.storageTemp, 1)} °C. Acima de 98,5% não há posição livre e a armazenagem
            passa a limitar a produção.
          </Paragraph>
        </section>
        <section className="ff-panel">
          <Heading level={6} as="h2">
            Mix de produtos expedidos (t)
          </Heading>
          {T.byProduct.length ? (
            <DonutChart data={T.byProduct} labelAccessor="produto" valueAccessor="t" height={330} colorPalette={PRODUCT_COLORS} formatter={(v: number) => `${fmtDec(v, 1)} t`} />
          ) : (
            <div className="ff-empty">Sem expedição registrada ainda hoje.</div>
          )}
        </section>
      </div>

      <section className="ff-panel">
        <Heading level={6} as="h2">
          Cargas de hoje
        </Heading>
        {snap.loadsToday.length ? (
          <DataTable data={snap.loadsToday} columns={COLUMNS} sortable variant={{ rowDensity: "condensed", rowSeparation: "horizontalDividers" }} fullWidth>
            <DataTable.Pagination defaultPageSize={10} />
          </DataTable>
        ) : (
          <div className="ff-empty">Nenhuma carga ainda hoje.</div>
        )}
        <SourceTag text="Um registro por load.id com o último estado do Business Flow de expedição" />
      </section>
    </div>
  );
};
