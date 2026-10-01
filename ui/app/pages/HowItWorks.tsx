import React from "react";
import { Heading, List, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { SCENARIOS } from "../sim/scenarios";

export const HowItWorks = () => (
  <div className="ff-about">
    <Heading level={2}>Como funciona</Heading>
    <Paragraph>
      <Strong>Poultry Industry</Strong> mostra, em movimento, a etapa final da cadeia verticalizada do frango: do caminhão de aves vivas na balança à
      carga que sai pela portaria com NF-e autorizada, rumo ao mercado interno ou ao porto. É uma <Strong>demonstração</Strong>: os dados vêm de um
      simulador que roda no seu navegador, para uma empresa fictícia. Nada é lido nem gravado no seu ambiente Dynatrace, e o app não pede permissões de
      dados.
    </Paragraph>

    <Heading level={4}>A cadeia, elo por elo</Heading>
    <List ordered>
      <li>Caminhões de aves vivas chegam das granjas integradas (≈ 4.200 aves, 12 t) e são pesados na balança de frango vivo (bruto).</li>
      <li>Aguardam no galpão de espera, com ventilação e nebulização, até a descarga; depois voltam à balança para a tara.</li>
      <li>Duas linhas de abate (até 7.500 aves/h cada) passam por insensibilização, sangria, escaldagem, depenagem, evisceração, inspeção do SIF e chiller.</li>
      <li>Cortes, miúdos, patas e industrializados são embalados em caixas de 18 kg.</li>
      <li>As caixas passam pela antecâmara e pelos túneis de congelamento (−35 °C, ≈ 18 h) e vão para a câmara fria (−22 °C).</li>
      <li>As cargas vendidas são separadas e carregadas nas docas, pesadas na balança de produto acabado e faturadas: NF-e autorizada pela SEFAZ-PR.</li>
      <li>A portaria libera a saída: mercado interno (por UF) ou contêiner para o porto de Paranaguá, com a DU-E feita a partir da chave da NF-e.</li>
    </List>

    <Heading level={4}>Gargalos e contrapressão</Heading>
    <Paragraph>
      Qualquer elo que trava empurra o problema para trás. Sem NF-e, o caminhão carregado não sai; com o pátio cheio, ele fica preso na doca; sem doca, o
      picking para; com a câmara cheia, os túneis não descarregam; com a antecâmara lotada, a linha precisa reduzir — enquanto as aves continuam chegando. O
      painel <Strong>Gargalos da cadeia</Strong> mostra a restrição atual e marca com ▲ os elos que já sentem a contrapressão.
    </Paragraph>

    <Heading level={4}>O plano do PCP</Heading>
    <Paragraph>
      A produção segue o <Strong>planejamento do PCP</Strong>: um calendário diário com as aves a abater e os quilos de produto de cada dia útil
      (≈ 255 mil aves e 575 t). A aba <Strong>Plano PCP</Strong> compara o realizado com o plano até a hora atual, projeta o fechamento do dia e do mês e
      mostra quanto cada incidente custou em horas de abate. Quando o dia ou o mês ficam para trás, o PCP recupera com <Strong>hora extra</Strong> (até 2 h
      por dia, CLT art. 59) ou com um <Strong>dia extra</Strong> de abate (um turno no sábado). Aves não abatidas continuam nos integrados, ganhando peso e
      consumindo ração. O dia de produção vai das 03:00 às 03:00.
    </Paragraph>

    <Heading level={4}>O que é simulado</Heading>
    <List>
      <li>Relógio da planta no seu fuso horário, com turnos 05:00–13:48 e 14:30–23:18 e higienização à noite. Velocidade padrão de 60× (1 min = 1 h).</li>
      <li>Chegadas de caminhões reguladas pelo estoque do galpão; cargas de expedição com exportação como alavanca de equilíbrio do estoque.</li>
      <li>Rendimento, condenações por causa, DOA, congelamento com tempo dependente da temperatura, ocupação da câmara e posições livres.</li>
      <li>NF-e com cStat, tpEmis, latência, protocolo e chave de acesso (CNPJ mascarado). Clientes, integrados e veículos são códigos fictícios.</li>
      <li>
        Plano do PCP: calendário do mês com feriados nacionais; os dias anteriores à sessão são um histórico sintético e determinístico (perdas, hora
        extra e sábados extras); o dia de hoje vem da simulação. A planta simulada abate todos os dias: num sábado, domingo ou feriado, o calendário mostra o
        dia como abate extra.
      </li>
      <li>As análises da Dynatrace Intelligence são roteirizadas por cenário; os números de impacto saem do próprio modelo.</li>
    </List>

    <Heading level={4}>Números de referência</Heading>
    <Paragraph>
      Cerca de 256 mil aves e 729 t de peso vivo por dia (plano do PCP de ≈ 255 mil), rendimento de carcaça de 73,9%, DOA de ~0,18%, condenação total de 0,30% e parcial de 8%, ~575 t
      de produto acabado, 32 cargas por dia (≈ 60% do peso em exportação), câmara fria perto de 80% e NF-e autorizadas em ~1–2 s. Fontes e premissas estão
      no documento de pesquisa e planejamento do repositório (<code>specs/poultry-industry.md</code>).
    </Paragraph>

    <Heading level={4}>Cenários do apresentador</Heading>
    <List>
      {SCENARIOS.map((s) => (
        <li key={s.id}>
          <Strong>
            {s.key} · {s.name}
          </Strong>{" "}
          — {s.summary}.
        </li>
      ))}
    </List>

    <Heading level={4}>O que muda com dados reais</Heading>
    <List>
      <li>Pesagens, caminhões, caixas, paletes, cargas e NF-e: Business Events via OpenPipeline, ligados por truck.id e load.id no Business Flow.</li>
      <li>Galpão, linhas, evisceradoras, refrigeração por amônia e câmara: métricas OT por um OpenTelemetry Collector (OPC UA / Modbus).</li>
      <li>ERP e mensageria NF-e: OneAgent (traces, logs e métricas); validade do certificado como evento diário.</li>
      <li>SEFAZ-PR e SVC-RS: monitores sintéticos do serviço de status; a troca para contingência por Workflow.</li>
      <li>Problemas, causa raiz e previsões: Dynatrace Intelligence.</li>
    </List>
    <Paragraph>
      A aba <Strong>Dados e integrações</Strong> lista cada evento, campo e métrica a conectar, e a ordem sugerida de implantação.
    </Paragraph>

    <Heading level={4}>Atalhos</Heading>
    <Paragraph>
      0 normal · 1–7 cenários · Espaço pausa · + / − velocidade · D fontes · T modo TV · R resumo · P apresentador · I Dynatrace Intelligence · H hora
      extra recomendada · Esc fecha.
    </Paragraph>
  </div>
);
