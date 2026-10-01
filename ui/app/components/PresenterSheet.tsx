import React, { useState } from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { KeyboardShortcut } from "@dynatrace/strato-components/content";
import { Switch, TextInput, ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import { Sheet } from "@dynatrace/strato-components/overlays";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { SCENARIOS } from "../sim/scenarios";
import { fmtDate, fmtDuration, fmtH, fmtHour } from "../sim/time";
import { useApp, useSnapshot } from "../state/engine-context";

const HOURS: [string, number | null][] = [
  ["Agora", null],
  ["04:00", 4],
  ["07:00", 7],
  ["10:00", 10],
  ["13:50", 13.84],
  ["17:00", 17],
  ["23:30", 23.5],
];

const SHORTCUTS: [string, string][] = [
  ["0", "Operação normal (encerra incidentes)"],
  ["1–7", "Cenários"],
  ["Espaço", "Pausar / continuar"],
  ["=", "Mais rápido (+ ou =)"],
  ["-", "Mais devagar"],
  ["D", "Fontes Dynatrace"],
  ["T", "Modo TV"],
  ["R", "Resumo da demonstração"],
  ["P", "Painel do apresentador"],
  ["I", "Dynatrace Intelligence"],
  ["H", "Aprovar a hora extra recomendada pelo PCP"],
];

export const PresenterSheet = ({ onTour }: { onTour: () => void }) => {
  const { engine, ui, setUi, prefs, setPrefs } = useApp();
  const snap = useSnapshot();
  const [hour, setHour] = useState("Agora");
  const [seed, setSeed] = useState(String(engine.seed));

  return (
    <Sheet show={ui.presenter} title="Painel do apresentador" onDismiss={() => setUi({ presenter: false })}>
      <div className="ff-presenter">
        <Heading level={6}>Cenários — um por elo da cadeia</Heading>
        {SCENARIOS.map((s) => {
          const st = snap.scenarios.find((x) => x.id === s.id);
          const on = st?.phase === "active";
          return (
            <div key={s.id} className="ff-scn">
              <Switch value={on} disabled={st?.phase === "recovering"} onChange={() => engine.toggleScenario(s.id)}>
                <b>
                  {s.key} · {s.name}
                </b>
              </Switch>
              <Text className="ff-muted">
                {s.link} · {s.summary} · {fmtDuration(s.durationMin)} de planta
                {st?.phase === "recovering" ? " · normalizando…" : on ? ` · há ${fmtDuration(st?.elapsedMin ?? 0)}` : ""}
              </Text>
            </div>
          );
        })}
        <Button onClick={() => engine.normalize()}>0 · Encerrar incidentes ativos</Button>

        <Heading level={6}>Plano do PCP</Heading>
        <Text className="ff-muted">
          {snap.pcp.recovery.title} · hora extra hoje: {snap.pcp.today.extraH > 0 ? fmtH(snap.pcp.today.extraH) : "nenhuma"} · abate até{" "}
          {fmtHour(snap.pcp.today.endHour)}
        </Text>
        <div className="ff-row">
          <Button
            disabled={snap.pcp.recovery.overtimeToday <= 0}
            onClick={() => engine.approveOvertime(snap.pcp.today.extraH + (snap.pcp.recovery.suggestTodayH > 0 ? snap.pcp.recovery.suggestTodayH : 0.5))}
          >
            H · Aprovar {fmtH(snap.pcp.recovery.suggestTodayH > 0 ? snap.pcp.recovery.suggestTodayH : 0.5)} de hora extra
          </Button>
          <Button disabled={snap.pcp.recovery.saturday === undefined} onClick={() => engine.toggleSaturday(snap.pcp.recovery.saturday ?? 0)}>
            Programar sábado extra{snap.pcp.recovery.saturday !== undefined ? ` (${fmtDate(snap.pcp.recovery.saturday)})` : ""}
          </Button>
        </div>

        <Heading level={6}>Relógio da planta</Heading>
        <ToggleButtonGroup value={String(snap.speed)} onChange={(v) => engine.setSpeed(Number(v))} aria-label="Velocidade">
          <ToggleButtonGroup.Item value="1">1× tempo real</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="10">10×</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="60">60× (1 min = 1 h)</ToggleButtonGroup.Item>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          value={hour}
          onChange={(v) => {
            setHour(v);
            engine.setHour(HOURS.find((h) => h[0] === v)?.[1] ?? null);
          }}
          aria-label="Hora simulada"
        >
          {HOURS.map(([label]) => (
            <ToggleButtonGroup.Item key={label} value={label}>
              {label}
            </ToggleButtonGroup.Item>
          ))}
        </ToggleButtonGroup>
        <Text className="ff-muted">Mudar a hora reconstrói as últimas 30 h da planta e encerra os incidentes.</Text>

        <Heading level={6}>Ensaio</Heading>
        <div className="ff-row">
          <TextInput value={seed} onChange={(v) => setSeed(v)} aria-label="Semente da simulação" />
          <Button
            onClick={() => {
              const n = Number(seed);
              engine.reset(Number.isFinite(n) && n > 0 ? n : engine.seed);
              setHour("Agora");
            }}
          >
            Reiniciar o dia
          </Button>
        </div>
        <Text className="ff-muted">A mesma semente, na mesma hora, reproduz exatamente os mesmos caminhões e cargas.</Text>
        <Button variant="accent" color="primary" onClick={onTour}>
          Iniciar tour automático (6 min)
        </Button>

        <Heading level={6}>Link para dashboard (opcional)</Heading>
        <Text className="ff-muted">ID do documento de um dashboard deste ambiente. Quando preenchido, o painel de detalhes mostra “Abrir dashboard”.</Text>
        <TextInput value={prefs.dashboardId} onChange={(v) => setPrefs({ dashboardId: v.trim() })} placeholder="ID do dashboard" />

        <Heading level={6}>Atalhos</Heading>
        <div className="ff-shortcuts">
          {SHORTCUTS.map(([k, label]) => (
            <div key={k} className="ff-shortcut">
              <KeyboardShortcut keys={k} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
};
