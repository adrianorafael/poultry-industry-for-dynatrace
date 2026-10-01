import React from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { PageLayout } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { openDocument } from "@dynatrace-sdk/navigation";
import { KPI_INFO, STAGE_INFO } from "../data/stages";
import { PRODUCT_BY_ID, VEHICLES } from "../sim/model";
import { fmtClock, fmtDuration } from "../sim/time";
import type { LiveTruck, Load, Snapshot } from "../sim/types";
import { BRAND, LEVEL_COLOR, LEVEL_LABEL, MARKET_COLOR, type Level } from "../theme/colors";
import { useApp, useSnapshot, type Selection } from "../state/engine-context";
import { fmtBrl, fmtDec, fmtInt, fmtKg, fmtT, fmtUsd } from "../format";
import { Sparkline } from "./KpiRibbon";
import { StatusPill } from "./StatusPill";

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="ff-kv">
    <span>{k}</span>
    <span>{v}</span>
  </div>
);

const DashboardLink = ({ id }: { id: string }) =>
  id ? (
    <Button variant="emphasized" onClick={() => openDocument(id)}>
      Abrir dashboard
    </Button>
  ) : null;

interface Step {
  name: string;
  sub: string;
  start?: number;
  end?: number;
  level: Level;
}

/** Trace-like waterfall in plant minutes. */
const Waterfall = ({ steps, now }: { steps: Step[]; now: number }) => {
  const known = steps.filter((s) => s.start !== undefined);
  const t0 = Math.min(...known.map((s) => s.start as number));
  const t1 = Math.max(...known.map((s) => s.end ?? now));
  const span = Math.max(1, t1 - t0);
  return (
    <div className="ff-wf" role="table" aria-label="Etapas">
      {steps.map((s) => {
        const pending = s.start !== undefined && s.end === undefined;
        const dur = s.start !== undefined ? ((s.end ?? now) - s.start) / 60_000 : 0;
        return (
          <div key={s.name} className="ff-wf-row" role="row">
            <div className="ff-wf-name" role="cell">
              <span>{s.name}</span>
              <small>{s.sub}</small>
            </div>
            <div className="ff-wf-track" role="cell">
              {s.start !== undefined && (
                <div
                  className={`ff-wf-bar ${pending ? "ff-wf-pend" : ""}`}
                  style={{
                    left: `${((s.start - t0) / span) * 100}%`,
                    width: `${Math.max(0.8, (((s.end ?? now) - s.start) / span) * 100)}%`,
                    background: LEVEL_COLOR[s.level],
                  }}
                />
              )}
            </div>
            <div className="ff-wf-dur" role="cell">
              {s.start === undefined ? "—" : fmtDuration(dur)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TruckDetails = ({ t, snap }: { t: LiveTruck; snap: Snapshot }) => {
  const now = snap.simTime;
  const waitMin = t.t.shedIn ? ((t.t.unloadStart ?? now) - t.t.shedIn) / 60_000 : 0;
  const steps: Step[] = [
    { name: "Viagem da granja", sub: `${t.farm} · ${t.km} km`, start: t.t.loaded, end: t.t.arrive, level: "ok" },
    { name: "Fila e pesagem bruta", sub: "Balança de frango vivo", start: t.t.arrive, end: t.t.scaleIn, level: t.blocked ? "critical" : "ok" },
    {
      name: "Espera no galpão",
      sub: `baia ${t.bay >= 0 ? t.bay + 1 : "—"}`,
      start: t.t.shedIn,
      end: t.t.unloadStart,
      level: waitMin > 180 ? "critical" : waitMin > 120 ? "warning" : "ok",
    },
    { name: "Descarga e pendura", sub: "plataforma", start: t.t.unloadStart, end: t.t.unloadEnd, level: "ok" },
    { name: "Pesagem tara", sub: "Balança de frango vivo", start: t.t.unloadEnd, end: t.t.scaleOut, level: "ok" },
  ];
  const dead = t.netKg !== undefined ? undefined : t.doa;
  return (
    <>
      <div className="ff-det-head">
        <div className="ff-det-icon" style={{ background: BRAND.amber }}>
          FV
        </div>
        <div>
          <Heading level={5}>Caminhão de aves vivas {t.id}</Heading>
          <Text className="ff-muted">
            {t.farm} · GTA {t.gta} · chegada {fmtClock(t.t.arrive)}
          </Text>
        </div>
      </div>
      <Waterfall steps={steps} now={now} />
      <div className="ff-kvs">
        <Row k="Aves carregadas" v={fmtInt(t.birds)} />
        <Row k="Peso vivo médio" v={`${fmtDec(t.kgPerBird, 2)} kg/ave`} />
        <Row k="Peso bruto" v={t.grossKg ? fmtKg(t.grossKg) : "—"} />
        <Row k="Tara" v={t.tareMeasuredKg ? fmtKg(t.tareMeasuredKg) : "—"} />
        <Row k="Peso líquido (acerto do integrado)" v={t.netKg ? fmtKg(t.netKg) : "—"} />
        <Row k="Mortas (DOA)" v={dead !== undefined ? `${fmtInt(dead)} até agora` : "ver ticket de tara"} />
        <Row k="Espera no galpão" v={t.t.shedIn ? fmtDuration(waitMin) : "—"} />
      </div>
      <Text className="ff-muted">
        Na vida real: cada etapa é um Business Event com o ID do caminhão como correlação — o Business Flow mede o tempo entre elas.
      </Text>
    </>
  );
};

const LoadDetails = ({ l, snap }: { l: Load; snap: Snapshot }) => {
  const now = snap.simTime;
  const invoiceEnd = l.t.authorized;
  const steps: Step[] = [
    { name: "Chegada e tara", sub: "Balança de produto acabado", start: l.t.arrive, end: l.t.tare, level: "ok" },
    { name: "Aguardando doca", sub: "pátio", start: l.t.tare, end: l.t.dockIn, level: "ok" },
    { name: "Picking e carregamento", sub: `doca ${l.dock >= 0 ? l.dock + 1 : "—"} · ${fmtInt(l.pallets)} paletes`, start: l.t.dockIn, end: l.t.loaded, level: "ok" },
    { name: "Pesagem bruta", sub: `divergência ${fmtDec(l.divergencePct, 2)}%`, start: l.t.loaded, end: l.t.gross, level: l.blocked ? "critical" : Math.abs(l.divergencePct) > 0.5 ? "warning" : "ok" },
    {
      name: "Faturamento e NF-e",
      sub: "ERP → mensageria → SEFAZ",
      start: l.t.gross,
      end: invoiceEnd,
      level: l.nfes.some((n) => n.state === "rejected" || n.state === "retry") || l.nfeState === "ticket" || l.nfeState === "manual" ? "critical" : "ok",
    },
    { name: "DANFE, MDF-e e portaria", sub: "saída", start: invoiceEnd, end: l.t.exit, level: "ok" },
  ];
  if (l.market === "EXP") steps.push({ name: "Viagem ao porto", sub: `${l.port ?? "Paranaguá"} · cut-off ${fmtClock(l.cutoff)}`, start: l.t.exit, end: l.t.portEta, level: l.t.portEta && l.t.portEta > l.cutoff ? "critical" : "ok" });
  return (
    <>
      <div className="ff-det-head">
        <div className="ff-det-icon" style={{ background: MARKET_COLOR[l.market] }}>
          {l.market === "EXP" ? "EXP" : "MI"}
        </div>
        <div>
          <Heading level={5}>Carga {l.id}</Heading>
          <Text className="ff-muted">
            {VEHICLES[l.vehicle].label} · {l.market === "EXP" ? `exportação → ${l.destName}` : `mercado interno → ${l.dest}`} · {l.customer}
          </Text>
        </div>
      </div>
      <Waterfall steps={steps} now={now} />
      <div className="ff-kvs">
        <Row k="Produtos" v={l.products.map((p) => `${PRODUCT_BY_ID[p.id].label} (${p.pallets} pal.)`).join(", ")} />
        <Row k="Peso" v={fmtT(l.kg, 1)} />
        <Row k="Valor" v={l.market === "EXP" ? `${fmtUsd(l.valueUsd)} · ${fmtBrl(l.valueBrl)}` : fmtBrl(l.valueBrl)} />
        {l.market === "EXP" && <Row k="DU-E" v={l.t.exit ? "registrada a partir da chave da NF-e" : "aguarda a NF-e"} />}
      </div>
      <Heading level={6}>NF-e</Heading>
      {l.nfes.length === 0 && <Text className="ff-muted">Nota ainda não emitida (a emissão começa depois da pesagem bruta e do ticket no ERP).</Text>}
      {l.nfes.map((n) => (
        <div key={n.number} className="ff-nfe-card">
          <div className="ff-det-chips">
            <b>NF-e {String(n.number).padStart(9, "0")}</b>
            <StatusPill level={n.cStat === 100 ? "ok" : n.state === "rejected" ? "critical" : "warning"} text={n.cStat > 0 ? `cStat ${n.cStat}` : "enviada"} />
            <span className="ff-muted">
              tpEmis {n.tpEmis} · CFOP {n.cfop}
            </span>
          </div>
          <Row k="Chave de acesso" v={<code>{n.key}</code>} />
          <Row k="Situação" v={n.xMotivo} />
          {n.protocol && <Row k="Protocolo" v={`${n.protocol}${n.latencyS ? ` · ${fmtDec(n.latencyS, 2)} s` : ""}`} />}
          <Row k="Valor" v={fmtBrl(n.valueBrl)} />
        </div>
      ))}
      <Text className="ff-muted">CNPJ do emitente mascarado na chave (empresa fictícia).</Text>
    </>
  );
};

const Body = ({ sel, snap }: { sel: Selection; snap: Snapshot }) => {
  const { engine, prefs } = useApp();
  if (sel.type === "truck") {
    const t = engine.getTruck(sel.id);
    if (!t) return <Text className="ff-muted">Este caminhão não está mais no histórico recente.</Text>;
    return <TruckDetails t={t} snap={snap} />;
  }
  if (sel.type === "load") {
    const l = engine.getLoad(sel.id);
    if (!l) return <Text className="ff-muted">Esta carga não está mais no histórico recente.</Text>;
    return <LoadDetails l={l} snap={snap} />;
  }
  if (sel.type === "stage") {
    const info = STAGE_INFO[sel.id];
    const st = snap.stages.find((s) => s.id === sel.id);
    return (
      <>
        <Heading level={5}>{info.title}</Heading>
        {st && (
          <div className="ff-det-chips">
            <StatusPill level={st.level} text={LEVEL_LABEL[st.level]} />
            <span>{st.value}</span>
            {st.constraint && <StatusPill level="critical" text="restrição atual" />}
            {st.pressure && <StatusPill level="warning" text="contrapressão" />}
          </div>
        )}
        <div className="ff-card-sec">
          <span className="ff-card-k">O que acontece aqui</span>
          {info.what}
        </div>
        <div className="ff-card-sec">
          <span className="ff-card-k">Como vira gargalo</span>
          {info.bottleneck}
        </div>
        <div className="ff-card-sec">
          <span className="ff-card-k">Na vida real, no Dynatrace</span>
          {info.source}
        </div>
        <DashboardLink id={prefs.dashboardId} />
      </>
    );
  }
  const info = KPI_INFO[sel.key];
  if (!info) return null;
  return (
    <>
      <Heading level={5}>{info.title}</Heading>
      <div className="ff-card-sec">{info.what}</div>
      <div className="ff-card-sec">
        <span className="ff-card-k">Limiares</span>
        {info.thresholds}
      </div>
      <div className="ff-det-spark">
        <span className="ff-card-k">Últimas 6 h de planta</span>
        <Sparkline data={snap.spark[info.spark]} color={BRAND.teal} width={380} height={60} />
      </div>
      <DashboardLink id={prefs.dashboardId} />
    </>
  );
};

export const DetailsPanel = () => {
  const { selection, select } = useApp();
  const snap = useSnapshot();
  return (
    <PageLayout.Details collapsed={!selection} onCollapsedChange={(c) => c && select(null)} defaultLayout="overlay" defaultWidth="34%" minWidth={420}>
      <PageLayout.Details.ControlBar />
      <div className="ff-details">{selection && <Body sel={selection} snap={snap} />}</div>
    </PageLayout.Details>
  );
};
