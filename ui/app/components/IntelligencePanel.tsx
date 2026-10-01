import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@dynatrace/strato-components/buttons";
import { AiLoadingIndicator, AiResponse, Chip } from "@dynatrace/strato-components/content";
import { showToast } from "@dynatrace/strato-components/notifications";
import { ExternalLink, Text } from "@dynatrace/strato-components/typography";
import { Tooltip } from "@dynatrace/strato-components/overlays";
import { AiIcon } from "@dynatrace/strato-icons";
import type { ProblemView } from "../sim/types";
import type { Level } from "../theme/colors";
import { useApp, useSnapshot } from "../state/engine-context";
import { Panel } from "./Panel";
import { StatusPill } from "./StatusPill";

const STATUS_TEXT: Record<ProblemView["status"], string> = {
  Active: "Ativo",
  Forecast: "Previsão",
  Resolved: "Resolvido",
};

function levelOf(p: ProblemView): Level {
  if (p.status === "Active") return p.severity === "critical" ? "critical" : "warning";
  if (p.status === "Forecast") return "warning";
  return "ok";
}

/** Intelligence explanation: "Analisando..." then streamed text (scripted in this simulation). */
const Explanation = ({ id, text }: { id: string; text: string }) => {
  const [stage, setStage] = useState<"loading" | "streaming" | "done">("loading");
  useEffect(() => {
    setStage("loading");
    const a = window.setTimeout(() => setStage("streaming"), 1500);
    const b = window.setTimeout(() => setStage("done"), 9000);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [id]);
  if (stage === "loading") return <AiLoadingIndicator>Analisando...</AiLoadingIndicator>;
  return <AiResponse responseState={stage === "streaming" ? "streaming" : "complete"}>{text}</AiResponse>;
};

/** One-click follow-up of a problem (e.g. approve the overtime the PCP needs). */
const Cta = ({ cta }: { cta: NonNullable<ProblemView["cta"]> }) => {
  const { engine } = useApp();
  const navigate = useNavigate();
  return (
    <div className="ff-card-cta">
      <Button
        size="condensed"
        variant="emphasized"
        color="primary"
        onClick={() => {
          if (cta.overtimeH !== undefined) {
            engine.approveOvertime(cta.overtimeH);
            showToast({ type: "success", title: "Hora extra aprovada", message: "O abate de hoje foi estendido no plano do PCP.", lifespan: 4000 });
          } else if (cta.route) navigate(cta.route);
        }}
      >
        {cta.label}
      </Button>
    </div>
  );
};

const Card = ({ p, expanded }: { p: ProblemView; expanded: boolean }) => {
  const { engine } = useApp();
  const lvl = levelOf(p);
  return (
    <article className={`ff-card ff-card-${lvl}`}>
      <div className="ff-card-top">
        <StatusPill level={lvl} text={STATUS_TEXT[p.status]} />
        <Tooltip text="Recurso com IA (Dynatrace Intelligence)">
          <Chip size="condensed" color="primary">
            <Chip.Prefix>
              <AiIcon />
            </Chip.Prefix>
            Intelligence
          </Chip>
        </Tooltip>
        <Chip size="condensed" color="neutral">
          Simulação
        </Chip>
      </div>
      <strong className="ff-card-title">{p.title}</strong>
      <div className="ff-card-meta">
        {p.status === "Forecast" ? p.duration : `Início ${p.start} · ${p.duration}`}
        {p.mttdMin !== undefined && <> · detectado em {p.mttdMin} min</>}
      </div>
      <div className="ff-card-ents">
        {p.entities.map((e) => (
          <button key={e.id} type="button" className="ff-ent" onClick={() => engine.highlight(e.id)}>
            {e.label}
          </button>
        ))}
      </div>
      {expanded && (
        <>
          <div className="ff-card-sec">
            <span className="ff-card-k">Causa raiz</span>
            {p.rootCause}
          </div>
          {p.impacts.length > 0 && (
            <div className="ff-card-impacts">
              {p.impacts.map((i) => (
                <div key={i.label} className="ff-impact">
                  <span className="ff-impact-v">{i.value}</span>
                  <span className="ff-impact-l">
                    {i.label}
                    {i.note && <b> · {i.note}</b>}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="ff-card-sec">
            <span className="ff-card-k">Ação recomendada</span>
            {p.action}
          </div>
          {p.cta && <Cta cta={p.cta} />}
          <div className="ff-card-ai">
            <Explanation id={p.id} text={p.explanation} />
          </div>
        </>
      )}
      {!expanded && p.impacts.length > 0 && (
        <div className="ff-card-meta">{p.impacts.map((i) => `${i.label}: ${i.value}${i.note ? ` (${i.note})` : ""}`).join(" · ")}</div>
      )}
      {!expanded && p.cta && <Cta cta={p.cta} />}
    </article>
  );
};

/** A toast for every new problem (lives in the drawer, which is always mounted). */
export function useProblemToasts(problems: ProblemView[]): void {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const p of problems) {
      if (p.status !== "Active" || seen.current.has(p.id)) continue;
      seen.current.add(p.id);
      showToast({
        type: p.severity === "critical" ? "critical" : "warning",
        title: `Dynatrace Intelligence: ${p.title}`,
        message: `Detectado em ${p.mttdMin ?? 0} min · causa raiz identificada`,
        lifespan: 5000,
      });
    }
  }, [problems]);
}

export const IntelligencePanel = ({ onClose }: { onClose?: () => void }) => {
  const snap = useSnapshot();
  const firstExpanded = snap.problems.findIndex((p) => p.status !== "Resolved");
  return (
    <Panel
      title="Dynatrace Intelligence"
      source="IA causal e preditiva da Dynatrace Intelligence sobre traces, métricas, logs e eventos de negócio correlacionados pela topologia"
      className="ff-intel"
      right={
        onClose && (
          <Button size="condensed" onClick={onClose} aria-label="Recolher Dynatrace Intelligence">
            Recolher
          </Button>
        )
      }
    >
      <div className="ff-cards">
        {snap.problems.map((p, i) => (
          <Card key={p.id} p={p} expanded={i === firstExpanded || (p.status !== "Resolved" && i < 2)} />
        ))}
      </div>
      <Text className="ff-disclaimer">
        A <ExternalLink href="https://docs.dynatrace.com/docs/dynatrace-intelligence">Dynatrace Intelligence</ExternalLink> usa IA. Sempre verifique
        informações e decisões importantes. Nesta demonstração, as análises são simuladas.
      </Text>
    </Panel>
  );
};
