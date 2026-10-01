import React, { useMemo, useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { CategoricalBarChart, TimeseriesChart, type CategoricalBarChartData, type Timeseries } from "@dynatrace/strato-components/charts";
import { ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import { DataTable, type DataTableColumnDef } from "@dynatrace/strato-components/tables";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { SourceTag } from "../components/SourceTag";
import { StatusPill } from "../components/StatusPill";
import { OVERTIME_MAX_H, PLAN_RATE, SATURDAY_BIRDS, SATURDAY_SHIFT_H } from "../sim/model";
import { fmtDate, fmtH, fmtHour } from "../sim/time";
import type { PcpDayView, PcpView } from "../sim/types";
import { LEVEL_COLOR, LEVEL_LABEL, PCP_COLOR } from "../theme/colors";
import { useApp, useSnapshot } from "../state/engine-context";
import { fmtDec, fmtInt, fmtPct, fmtT } from "../format";

type Metric = "aves" | "kg";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const KIND_LABEL: Record<PcpDayView["kind"], string> = { util: "Dia útil", sabado: "Sábado", domingo: "Domingo", feriado: "Feriado" };
const pad = (n: number) => String(n).padStart(2, "0");

const plan = (d: PcpDayView, m: Metric) => (m === "aves" ? (d.kind === "util" ? d.planBirds : d.extraPlanBirds) : d.kind === "util" ? d.planKg : d.extraPlanKg);
const actual = (d: PcpDayView, m: Metric) => (m === "aves" ? d.actualBirds : d.actualKg);
const short = (v: number, m: Metric) => (m === "aves" ? `${fmtDec(v / 1000, 1)} mil` : fmtT(v, 0));

/** Month calendar: plan and actual per day, overtime and extra days. */
const Calendar = ({ pcp, metric }: { pcp: PcpView; metric: Metric }) => {
  const lead = pcp.days[0]?.dow ?? 0;
  return (
    <div className="ff-cal" role="grid" aria-label={`Calendário do PCP de ${pcp.monthLabel}`}>
      {WEEKDAYS.map((w) => (
        <div key={w} className="ff-cal-head" role="columnheader">
          {w}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={`b${i}`} className="ff-cal-blank" aria-hidden />
      ))}
      {pcp.days.map((d) => {
        const p = plan(d, metric);
        const a = actual(d, metric);
        const off = d.kind !== "util" && !d.extraDay;
        const pct = d.adherence;
        const tip = [
          `${fmtDate(d.date)} · ${d.holiday ?? KIND_LABEL[d.kind]}`,
          p > 0 ? `Plano: ${short(p, metric)}` : "Sem abate planejado",
          a !== null && a > 0 ? `Realizado: ${short(a, metric)}${pct !== null ? ` (${fmtPct(pct, 1)})` : ""}` : "",
          d.extraH > 0 ? `Hora extra: ${fmtH(d.extraH)}` : "",
          d.extraDay ? "Dia extra de abate" : "",
          d.cause ? `Perda: ${d.cause}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        return (
          <div key={d.date} role="gridcell" title={tip} className={`ff-cal-cell ff-cal-${d.when} ${off ? "ff-cal-off" : ""} ${d.extraDay ? "ff-cal-extra" : ""}`}>
            <div className="ff-cal-top">
              <b>{d.dom}</b>
              <span className="ff-cal-badges">
                {d.extraH > 0 && <i className="ff-cal-he">HE {fmtH(d.extraH)}</i>}
                {d.extraDay && <i className="ff-cal-x">extra</i>}
                {d.cause && <i className="ff-cal-loss">!</i>}
              </span>
            </div>
            {off ? (
              <span className="ff-cal-note">{d.holiday ?? "sem abate"}</span>
            ) : (
              <>
                <span className="ff-cal-plan">plano {short(p, metric)}</span>
                <span className="ff-cal-act">{a !== null && (d.when !== "future" || a > 0) ? `real ${short(a, metric)}` : " "}</span>
                <span className="ff-cal-bar" aria-hidden>
                  {pct !== null && <i style={{ width: `${Math.min(100, pct)}%`, background: LEVEL_COLOR[d.level] }} />}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

const RecoveryCard = ({ pcp }: { pcp: PcpView }) => {
  const { engine } = useApp();
  const r = pcp.recovery;
  const t = pcp.today;
  const level = r.kind === "none" ? "ok" : r.kind === "unrecoverable" ? "critical" : "warning";
  const saturdays = pcp.days.filter((d) => d.kind === "sabado" && d.when === "future");
  const canAdd = r.overtimeToday > 0;
  const apply = () => {
    if (r.suggestTodayH > 0) engine.approveOvertime(t.extraH + r.suggestTodayH);
    if (r.kind === "saturday" && r.saturday !== undefined) engine.toggleSaturday(r.saturday);
  };
  return (
    <section className={`ff-panel ff-recovery ff-recovery-${level}`}>
      <div className="ff-recovery-top">
        <Heading level={6} as="h2">
          {r.scope === "day" ? "Recomendação do PCP para fechar o dia" : "Recomendação do PCP para fechar o mês"}
        </Heading>
        <StatusPill level={level} text={r.kind === "none" ? "No plano" : r.kind === "unrecoverable" ? "Meta em risco" : "Recuperar"} />
      </div>
      <strong className="ff-recovery-title">{r.title}</strong>
      <Text>{r.detail}</Text>
      <div className="ff-recovery-actions">
        <Button variant="accent" color="primary" disabled={r.kind === "none" || (r.suggestTodayH <= 0 && r.kind !== "saturday")} onClick={apply}>
          Aplicar recomendação
        </Button>
      </div>
      <div className="ff-recovery-row">
        <span className="ff-card-k">Hora extra hoje</span>
        <Button size="condensed" disabled={t.extraH <= 0} onClick={() => engine.approveOvertime(t.extraH - 0.25)} aria-label="Menos 15 minutos de hora extra">
          −15 min
        </Button>
        <b className="ff-recovery-he">{t.extraH > 0 ? fmtH(t.extraH) : "nenhuma"}</b>
        <Button size="condensed" disabled={!canAdd} onClick={() => engine.approveOvertime(t.extraH + 0.25)} aria-label="Mais 15 minutos de hora extra">
          +15 min
        </Button>
        <Text className="ff-muted">
          abate até {fmtHour(t.endHour)} · limite {fmtH(OVERTIME_MAX_H)} por dia (CLT, art. 59)
        </Text>
      </div>
      <div className="ff-recovery-row">
        <span className="ff-card-k">Sábados extras</span>
        {saturdays.length ? (
          saturdays.map((d) => (
            <Button
              key={d.date}
              size="condensed"
              variant={d.extraDay ? "emphasized" : "default"}
              color={d.extraDay ? "primary" : "neutral"}
              onClick={() => engine.toggleSaturday(d.date)}
              aria-pressed={d.extraDay}
            >
              {d.extraDay ? "✓ " : ""}
              {fmtDate(d.date)}
            </Button>
          ))
        ) : (
          <Text className="ff-muted">não há sábado livre até o fim do mês</Text>
        )}
        <Text className="ff-muted">
          1 turno de {fmtH(SATURDAY_SHIFT_H)} ≈ {fmtInt(SATURDAY_BIRDS)} aves
        </Text>
      </div>
      <SourceTag text="Calendário do PCP (APS/ERP) como lookup + poultry.bird.hung por hora; a projeção usa o ritmo planejado. Aprovar a hora extra pode disparar um Workflow para o PCP e o fomento (escala de apanha)" />
    </section>
  );
};

const COLUMNS: DataTableColumnDef<PcpDayView>[] = [
  { id: "date", header: "Dia", accessor: "date", width: 90, cell: ({ rowData }) => <span>{`${fmtDate(rowData.date)} ${WEEKDAYS[rowData.dow]}`}</span> },
  { id: "kind", header: "Tipo", accessor: (d) => (d.extraDay ? "Dia extra" : (d.holiday ?? KIND_LABEL[d.kind])), minWidth: 150 },
  { id: "planBirds", header: "Plano (aves)", accessor: (d) => (d.kind === "util" ? d.planBirds : d.extraPlanBirds), alignment: "right", width: 120, cell: ({ value }) => <span>{(value as number) > 0 ? fmtInt(value as number) : "—"}</span> },
  { id: "actualBirds", header: "Realizado (aves)", accessor: (d) => d.actualBirds ?? -1, alignment: "right", width: 130, cell: ({ value }) => <span>{(value as number) >= 0 ? fmtInt(value as number) : "—"}</span> },
  { id: "adherence", header: "Aderência", accessor: (d) => d.adherence ?? -1, alignment: "right", width: 100, cell: ({ value }) => <span>{(value as number) >= 0 ? fmtPct(value as number, 1) : "—"}</span> },
  { id: "planKg", header: "Plano (t)", accessor: "planKg", alignment: "right", width: 100, cell: ({ value }) => <span>{(value as number) > 0 ? fmtDec((value as number) / 1000, 1) : "—"}</span> },
  { id: "actualKg", header: "Realizado (t)", accessor: (d) => d.actualKg ?? -1, alignment: "right", width: 110, cell: ({ value }) => <span>{(value as number) >= 0 ? fmtDec((value as number) / 1000, 1) : "—"}</span> },
  { id: "extraH", header: "Hora extra", accessor: "extraH", alignment: "right", width: 100, cell: ({ value }) => <span>{(value as number) > 0 ? fmtH(value as number) : "—"}</span> },
  { id: "cause", header: "Observação", accessor: (d) => d.cause ?? "", minWidth: 220 },
];

export const Plan = () => {
  const snap = useSnapshot();
  const { prefs } = useApp();
  const [metric, setMetric] = useState<Metric>("aves");
  const pcp = snap.pcp;
  const t = pcp.today;
  const m = pcp.month;

  const cumulative = useMemo<Timeseries[]>(() => {
    let p = 0;
    let a = 0;
    const planPts: Timeseries["datapoints"] = [];
    const actualPts: Timeseries["datapoints"] = [];
    for (const d of pcp.days) {
      const start = new Date(d.date);
      const end = new Date(d.date + 86_400_000);
      p += d.kind === "util" ? (metric === "aves" ? d.planBirds : d.planKg) : 0;
      // thousand birds or tons: both are the raw value ÷ 1000
      planPts.push({ start, end, value: p / 1000 });
      if (d.when !== "future") {
        a += actual(d, metric) ?? 0;
        actualPts.push({ start, end, value: a / 1000 });
      }
    }
    return [
      { name: "Meta acumulada do PCP", unit: metric === "aves" ? "mil aves" : "t", datapoints: planPts },
      { name: "Realizado acumulado", unit: metric === "aves" ? "mil aves" : "t", datapoints: actualPts },
    ];
    // the realized curve moves with the snapshot; the plan only when the month or metric changes
  }, [pcp.days, metric]);

  const hourly = useMemo<CategoricalBarChartData[]>(
    () =>
      pcp.hourly.map((h) => ({
        category: `${pad(h.hour % 24)}h`,
        value: { Plano: Math.round(h.plan), Realizado: Math.round(h.actual ?? 0) },
      })),
    [pcp.hourly],
  );

  const projectedPct = m.planBirds > 0 ? (100 * m.projectedBirds) / m.planBirds : 100;
  const dayPct = t.planBirds > 0 ? (100 * t.projectedBirds) / t.planBirds : 0;
  const tiles: { label: string; value: string; sub: string; level?: keyof typeof LEVEL_COLOR }[] = [
    {
      label: t.extraDay ? "Hoje · aves (dia extra)" : "Hoje · aves abatidas",
      value: fmtInt(t.actualBirds),
      sub: t.adherence !== null ? `${fmtPct(t.adherence, 1)} do plano até agora (${fmtInt(t.planBirdsToNow)})` : `plano do dia ${fmtInt(t.planBirds)}`,
      level: t.level,
    },
    {
      label: "Hoje · produto embalado",
      value: fmtT(t.actualKg, 1),
      sub: t.kgAdherence !== null ? `${fmtPct(t.kgAdherence, 1)} do plano até agora` : `plano do dia ${fmtT(t.planKg, 0)}`,
    },
    {
      label: "Fechamento do dia (projeção)",
      value: fmtInt(t.projectedBirds),
      sub: `${fmtPct(dayPct, 1)} do plano de ${fmtInt(t.planBirds)} aves`,
    },
    {
      label: "Mês até agora",
      value: fmtPct(m.adherence, 1),
      sub: `${fmtInt(m.actualBirds)} de ${fmtInt(m.planToDateBirds)} aves`,
    },
    {
      label: "Projeção do mês",
      value: fmtPct(projectedPct, 1),
      sub: `meta ${fmtDec(m.planBirds / 1e6, 2)} mi aves · ${fmtT(m.planKg, 0)}`,
      level: m.level,
    },
    {
      label: "Recuperação no mês",
      value: `${fmtH(m.extraHours)} HE`,
      sub: `${fmtInt(m.extraDays)} dia(s) extra(s) · ${fmtInt(m.workdaysLeft)} dias úteis restantes`,
    },
  ];

  return (
    <div className={`ff-sales ff-plan ${prefs.tv ? "ff-tv" : ""}`}>
      <div className="ff-sales-head">
        <div>
          <Heading level={2}>Plano do PCP · {pcp.monthLabel}</Heading>
          <Text className="ff-muted">
            O PCP programa, para cada dia, as aves a abater e os quilos de produto. Os incidentes da linha comprometem o plano; para fechar a meta do mês, o
            PCP aprova hora extra (até {fmtH(OVERTIME_MAX_H)} por dia) ou um dia extra de abate. Dia de produção: 03:00 às 03:00.
          </Text>
        </div>
        <ToggleButtonGroup value={metric} onChange={(v) => setMetric(v as Metric)} aria-label="Unidade do calendário">
          <ToggleButtonGroup.Item value="aves">Aves</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="kg">Produto (t)</ToggleButtonGroup.Item>
        </ToggleButtonGroup>
      </div>

      <div className="ff-sales-tiles">
        {tiles.map((x) => {
          const bg = x.level && x.level !== "neutral" ? LEVEL_COLOR[x.level] : undefined;
          return (
            <div
              key={x.label}
              className={`ff-kpi ff-kpi-static ${bg ? "ff-kpi-status" : ""}`}
              style={bg ? { background: bg, color: x.level === "warning" ? "#1B1B1B" : "#FFFFFF" } : undefined}
              aria-label={`${x.label}: ${x.value}${x.level ? ` (${LEVEL_LABEL[x.level]})` : ""}`}
            >
              <span className="ff-kpi-label">{x.label}</span>
              <span className="ff-kpi-value">{x.value}</span>
              <span className="ff-kpi-sub">{x.sub}</span>
            </div>
          );
        })}
      </div>

      <div className="ff-plan-grid">
        <section className="ff-panel">
          <div className="ff-recovery-top">
            <Heading level={6} as="h2">
              Calendário diário do PCP ({metric === "aves" ? "aves abatidas" : "produto embalado"})
            </Heading>
            <span className="ff-cal-legend ff-muted">
              <i className="ff-cal-he">HE</i> hora extra · <i className="ff-cal-x">extra</i> dia extra · <i className="ff-cal-loss">!</i> perda
            </span>
          </div>
          <Calendar pcp={pcp} metric={metric} />
          <SourceTag text="Plano diário do PCP (APS/ERP) como tabela de lookup no Grail; realizado = poultry.bird.hung e poultry.box.packed somados por dia de produção" />
        </section>
        <div className="ff-plan-side">
          <RecoveryCard pcp={pcp} />
          <section className="ff-panel">
            <Heading level={6} as="h2">
              Mês anterior · {pcp.previous.label}
            </Heading>
            <Paragraph>
              <b>{fmtPct(pcp.previous.adherence, 1)}</b> da meta ({fmtInt(pcp.previous.actualBirds)} de {fmtInt(pcp.previous.planBirds)} aves) ·{" "}
              {pcp.previous.extraHours > 0 ? `${fmtH(pcp.previous.extraHours)} de hora extra` : "sem hora extra"} ·{" "}
              {pcp.previous.extraDays > 0 ? `${fmtInt(pcp.previous.extraDays)} dia(s) extra(s)` : "sem dia extra"}
            </Paragraph>
            <Text className="ff-muted">
              Ritmo planejado: {fmtInt(PLAN_RATE)} aves/h (2 linhas × 7.500 aves/h com ~97% de disponibilidade). Aves que não são abatidas continuam
              nos integrados, ganhando peso e consumindo ração, e empurram o alojamento do próximo lote.
            </Text>
          </section>
        </div>
      </div>

      <div className="ff-sales-grid ff-plan-charts">
        <section className="ff-panel">
          <Heading level={6} as="h2">
            Hoje: plano × realizado por hora (aves)
          </Heading>
          <CategoricalBarChart data={hourly} groupMode="grouped" height={260} colorPalette={{ Plano: PCP_COLOR.plan, Realizado: PCP_COLOR.actual }}>
            <CategoricalBarChart.ValueAxis formatter={(v: number) => fmtInt(v)} />
          </CategoricalBarChart>
          <SourceTag text="poultry.bird.hung por hora (makeTimeseries) contra a curva do plano nos turnos" />
        </section>
        <section className="ff-panel">
          <Heading level={6} as="h2">
            Mês: meta × realizado acumulados ({metric === "aves" ? "mil aves" : "t"})
          </Heading>
          <TimeseriesChart data={cumulative} height={260} colorPalette={{ "Meta acumulada do PCP": PCP_COLOR.plan, "Realizado acumulado": PCP_COLOR.actual }}>
            <TimeseriesChart.YAxis formatter={(v: number) => fmtInt(v)} />
          </TimeseriesChart>
          <SourceTag text="Soma acumulada por dia de produção; a meta vem do calendário do PCP" />
        </section>
      </div>

      <section className="ff-panel">
        <Heading level={6} as="h2">
          Dias do mês
        </Heading>
        <DataTable data={pcp.days} columns={COLUMNS} sortable variant={{ rowDensity: "condensed", rowSeparation: "horizontalDividers" }} fullWidth>
          <DataTable.Pagination defaultPageSize={10} />
        </DataTable>
      </section>
    </div>
  );
};
