import { useCallback, useEffect, useRef, useState } from "react";
import { SPEEDS } from "../sim/engine";
import { SCENARIOS, type ScenarioId } from "../sim/scenarios";
import { fmtHour } from "../sim/time";
import { useApp } from "./engine-context";

/** Presenter keyboard shortcuts. */
export function useShortcuts(): void {
  const { engine, prefs, setPrefs, ui, setUi, select } = useApp();
  const ref = useRef({ prefs, ui });
  useEffect(() => {
    ref.current = { prefs, ui };
  }, [prefs, ui]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const { prefs: p, ui: u } = ref.current;
      const k = e.key.toLowerCase();
      const scn = SCENARIOS.find((s) => s.key === k);
      const idx = SPEEDS.indexOf(engine.speed as (typeof SPEEDS)[number]);
      if (scn) engine.toggleScenario(scn.id);
      else if (k === "0") engine.normalize();
      else if (k === " ") {
        e.preventDefault();
        engine.togglePause();
      } else if (k === "+" || k === "=") engine.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, idx + 1)]);
      else if (k === "-") engine.setSpeed(SPEEDS[Math.max(0, idx - 1)]);
      else if (k === "d") setPrefs({ sources: !p.sources });
      else if (k === "t") setPrefs({ tv: !p.tv });
      else if (k === "r") setUi({ summary: !u.summary });
      else if (k === "p") setUi({ presenter: !u.presenter });
      else if (k === "i") setUi({ intel: !u.intel });
      else if (k === "h") {
        // approve the overtime the PCP recommends for today (or 30 min more when none is needed)
        const pcp = engine.getSnapshot().pcp;
        const add = pcp.recovery.suggestTodayH > 0 ? pcp.recovery.suggestTodayH : 0.5;
        engine.approveOvertime(pcp.today.extraH + add);
      }
      else if (k === "escape") {
        select(null);
        setUi({ intel: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, setPrefs, setUi, select]);
}

interface TourStep {
  at: number;
  caption: string | (() => string);
  run: () => void;
}

/** Automatic 6-minute tour of the demo storyline (plant clock at 60×). */
export function useTour(): { caption: string | null; running: boolean; start: () => void; stop: () => void } {
  const { engine, select, setPrefs, setUi } = useApp();
  const [running, setRunning] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const idx = useRef(0);
  const t0 = useRef(0);

  const on = useCallback(
    (id: ScenarioId, want: boolean) => {
      const st = engine.getSnapshot().scenarios.find((s) => s.id === id);
      if ((st?.phase === "active") !== want && st?.phase !== "recovering") engine.toggleScenario(id);
    },
    [engine],
  );

  const steps = useRef<TourStep[]>([]);
  useEffect(() => {
    steps.current = [
      {
        at: 0,
        caption: "A cadeia inteira em movimento, da balança de frango vivo à portaria: cada caminhão, caixa e NF-e é um evento de negócio.",
        run: () => {
          engine.normalize();
          engine.setSpeed(60);
        },
      },
      {
        at: 25,
        caption: "A Dynatrace Intelligence já avisa: o certificado digital que assina as NF-e vence em 12 dias.",
        run: () => {
          setUi({ intel: true });
          engine.highlight("cert");
        },
      },
      {
        at: 50,
        caption: "Um caminhão de aves vivas: viagem, pesagem bruta, espera no galpão, pendura e tara — a jornada inteira.",
        run: () => {
          setUi({ intel: false });
          const t = engine.trucks.find((x) => x.stage === "unloading") ?? engine.trucks.find((x) => x.stage === "shed");
          if (t) select({ type: "truck", id: t.id });
        },
      },
      {
        at: 85,
        caption: "Uma carga: picking, balança de produto acabado, NF-e autorizada pela SEFAZ-PR e saída pela portaria.",
        run: () => {
          const l = engine.loads.find((x) => x.nfes.length > 0) ?? engine.loads.find((x) => x.stage === "loading");
          if (l) select({ type: "load", id: l.id });
        },
      },
      {
        at: 120,
        caption: "O compressor C-3 desarmou: o Túnel 2 aquece, a antecâmara enche e a linha precisa reduzir. A causa raiz é o condensador.",
        run: () => {
          select(null);
          on("tunnel", true);
        },
      },
      {
        at: 185,
        caption: "O plano do PCP sente o incidente: o dia vai fechar abaixo do programado, e os lotes de hoje já estão a caminho. A Intelligence recomenda hora extra.",
        run: () => {
          setUi({ intel: true });
          engine.highlight("stage:linha");
        },
      },
      {
        at: 200,
        caption: () => `Hora extra aprovada com um clique: o abate de hoje vai até ${fmtHour(engine.getSnapshot().pcp.today.endHour)} e o plano do dia fecha.`,
        run: () => {
          const pcp = engine.getSnapshot().pcp;
          engine.approveOvertime(pcp.today.extraH + (pcp.recovery.suggestTodayH > 0 ? pcp.recovery.suggestTodayH : 0.5));
        },
      },
      {
        at: 215,
        caption: "Agora a SEFAZ-PR saiu do ar: sem NF-e, nenhuma carga sai. A Dynatrace separa a causa externa das internas.",
        run: () => {
          setUi({ intel: false });
          on("tunnel", false);
          on("sefaz", true);
        },
      },
      {
        at: 295,
        caption: "A SEFAZ-PR ativou a SVC-RS: o Workflow troca a emissão para contingência e o pátio começa a drenar.",
        run: () => engine.highlight("node:svc"),
      },
      {
        at: 322,
        caption: "Tudo vem de uma plataforma: veja a fonte de dados por trás de cada painel.",
        run: () => {
          on("sefaz", false);
          setPrefs({ sources: true });
        },
      },
      {
        at: 342,
        caption: "Resumo da demonstração.",
        run: () => {
          setPrefs({ sources: false });
          engine.normalize();
          setUi({ summary: true });
        },
      },
    ];
  }, [engine, on, select, setPrefs, setUi]);

  const stop = useCallback(() => {
    setRunning(false);
    setCaption(null);
  }, []);

  const start = useCallback(() => {
    idx.current = 0;
    t0.current = performance.now();
    setUi({ presenter: false });
    setRunning(true);
  }, [setUi]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - t0.current) / 1000;
      const list = steps.current;
      while (idx.current < list.length && elapsed >= list[idx.current].at) {
        const s = list[idx.current];
        s.run();
        setCaption(typeof s.caption === "function" ? s.caption() : s.caption);
        idx.current++;
      }
      if (idx.current >= list.length && elapsed > list[list.length - 1].at + 8) stop();
    }, 250);
    return () => window.clearInterval(timer);
  }, [running, stop]);

  return { caption, running, start, stop };
}
