import React from "react";
import { Button } from "@dynatrace/strato-components/buttons";
import { Modal } from "@dynatrace/strato-components/overlays";
import { Text } from "@dynatrace/strato-components/typography";
import { useApp, useSnapshot } from "../state/engine-context";
import { fmtH } from "../sim/time";
import { fmtDec, fmtInt, fmtPct } from "../format";

export const SessionSummary = () => {
  const { ui, setUi } = useApp();
  const snap = useSnapshot();
  const s = snap.session;
  const mttd = s.incidents.length ? s.incidents.reduce((a, i) => a + i.mttdMin, 0) / s.incidents.length : 0;
  const minutes = Math.max(1, (Date.now() - s.start) / 60_000);
  return (
    <Modal
      show={ui.summary}
      size="medium"
      title="Resumo da demonstração"
      onDismiss={() => setUi({ summary: false })}
      footer={<Button onClick={() => setUi({ summary: false })}>Fechar</Button>}
    >
      <div className="ff-summary">
        <div className="ff-summary-grid">
          <div>
            <b>{fmtInt(s.birds)}</b>
            <span>aves abatidas em {fmtInt(minutes)} min de demonstração</span>
          </div>
          <div>
            <b>{fmtDec(s.finishedKg / 1000, 1)} t</b>
            <span>de produto acabado embalado</span>
          </div>
          <div>
            <b>{fmtDec(s.shippedKg / 1000, 1)} t</b>
            <span>expedidas com NF-e autorizada</span>
          </div>
          <div>
            <b>{fmtInt(s.nfes)}</b>
            <span>NF-e autorizadas</span>
          </div>
          <div>
            <b>{fmtInt(s.incidents.length)}</b>
            <span>incidentes detectados</span>
          </div>
          <div>
            <b>{s.incidents.length ? `${fmtDec(mttd, 1)} min` : "—"}</b>
            <span>tempo médio até a detecção</span>
          </div>
        </div>
        <Text>
          <b>Plano do PCP:</b>{" "}
          {snap.pcp.today.adherence !== null ? `${fmtPct(snap.pcp.today.adherence, 1)} do plano do dia até agora` : "dia de produção ainda sem abate"} · mês{" "}
          {fmtPct(snap.pcp.month.adherence, 1)} · {snap.pcp.recovery.title.toLowerCase()}
          {snap.pcp.today.extraH > 0 ? ` · ${fmtH(snap.pcp.today.extraH)} de hora extra aprovada hoje` : ""}
        </Text>
        {s.incidents.length > 0 && (
          <ul className="ff-summary-list">
            {s.incidents.map((i, n) => (
              <li key={n}>
                <b>{i.name}</b> · detectado em {i.mttdMin} min · {i.impact}
              </li>
            ))}
          </ul>
        )}
        <Text className="ff-summary-quote">
          Sem observabilidade ponta a ponta, esses gargalos aparecem primeiro como caminhão parado no pátio ou linha reduzida — e a causa raiz é
          descoberta horas depois.
        </Text>
      </div>
    </Modal>
  );
};
