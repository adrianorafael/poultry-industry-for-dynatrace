import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components/layouts";
import { Chip } from "@dynatrace/strato-components/content";
import { ToggleButtonGroup } from "@dynatrace/strato-components/forms";
import { Tooltip } from "@dynatrace/strato-components/overlays";
import { DocumentIcon, InformationIcon, MaximizeIcon, PauseIcon, PlayIcon, SettingIcon } from "@dynatrace/strato-icons";
import { fmtClock, fmtDate } from "../sim/time";
import { useApp, useSnapshot } from "../state/engine-context";

const ROUTES: [string, string][] = [
  ["/", "Ao vivo"],
  ["/plano", "Plano PCP"],
  ["/vendas", "Vendas e expedição"],
  ["/como-funciona", "Como funciona"],
  ["/dados", "Dados e integrações"],
];

export const Header = () => {
  const { engine, prefs, setPrefs, setUi, ui } = useApp();
  const snap = useSnapshot();
  const { pathname } = useLocation();
  const active = snap.scenarios.filter((s) => s.phase === "active").length;
  return (
    <AppHeader>
      <AppHeader.Navigation>
        <AppHeader.Logo as={Link} to="/" appName="Poultry Industry" />
        {ROUTES.map(([to, label]) => (
          <AppHeader.NavigationItem key={to} as={Link} to={to} isSelected={pathname === to}>
            {label}
          </AppHeader.NavigationItem>
        ))}
      </AppHeader.Navigation>
      <AppHeader.ActionItems>
        <div className="ff-header-controls">
          <Tooltip text="Os dados são simulados no navegador; nada é lido nem gravado no ambiente">
            <Chip color="neutral" variant="emphasized">
              ● Simulação
            </Chip>
          </Tooltip>
          {active > 0 && (
            <Chip color="critical" variant="emphasized">
              {active} incidente(s) em andamento
            </Chip>
          )}
          {!prefs.tv && (
            <>
              <span className="ff-clock">
                {fmtDate(snap.simTime)} · {fmtClock(snap.simTime)} · {snap.shift}
              </span>
              <Tooltip text="Velocidade do relógio da planta (60× = 1 minuto real por hora de planta)">
                <ToggleButtonGroup value={String(snap.speed)} onChange={(v) => engine.setSpeed(Number(v))} aria-label="Velocidade">
                  <ToggleButtonGroup.Item value="1">1×</ToggleButtonGroup.Item>
                  <ToggleButtonGroup.Item value="10">10×</ToggleButtonGroup.Item>
                  <ToggleButtonGroup.Item value="60">60×</ToggleButtonGroup.Item>
                </ToggleButtonGroup>
              </Tooltip>
            </>
          )}
        </div>
        <AppHeader.ActionButton prefixIcon={snap.paused ? <PlayIcon /> : <PauseIcon />} showLabel={false} onClick={() => engine.togglePause()}>
          {snap.paused ? "Continuar (Espaço)" : "Pausar (Espaço)"}
        </AppHeader.ActionButton>
        <AppHeader.ActionButton prefixIcon={<InformationIcon />} isSelected={prefs.sources} onClick={() => setPrefs({ sources: !prefs.sources })}>
          Fontes Dynatrace
        </AppHeader.ActionButton>
        <AppHeader.ActionButton prefixIcon={<MaximizeIcon />} isSelected={prefs.tv} onClick={() => setPrefs({ tv: !prefs.tv })}>
          Modo TV
        </AppHeader.ActionButton>
        <AppHeader.ActionButton prefixIcon={<DocumentIcon />} onClick={() => setUi({ summary: true })}>
          Resumo
        </AppHeader.ActionButton>
        <AppHeader.ActionButton prefixIcon={<SettingIcon />} isSelected={ui.presenter} onClick={() => setUi({ presenter: !ui.presenter })}>
          Apresentador
        </AppHeader.ActionButton>
      </AppHeader.ActionItems>
    </AppHeader>
  );
};
