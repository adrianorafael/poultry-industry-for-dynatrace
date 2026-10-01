import React from "react";
import { Accordion, Chip } from "@dynatrace/strato-components/content";
import { SimpleTable } from "@dynatrace/strato-components/tables";
import { Heading, List, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { LAYERS, ROLLOUT, SCREEN_MAP, SECTIONS, type Field, type Metric, type ScreenMap, type Section, type Step } from "../data/integration-map";

const FIELD_COLUMNS = [
  { id: "field", header: "Campo", accessor: "field", minWidth: 200 },
  { id: "type", header: "Tipo", accessor: "type", minWidth: 110 },
  { id: "example", header: "Exemplo", accessor: "example", minWidth: 190 },
  { id: "producer", header: "Produzido por", accessor: "producer", minWidth: 180 },
  { id: "usage", header: "Usado no app em", accessor: "usage", minWidth: 170 },
];

const METRIC_COLUMNS = [
  { id: "metric", header: "Métrica / sinal", accessor: "metric", minWidth: 260 },
  { id: "unit", header: "Unidade", accessor: "unit", minWidth: 90 },
  { id: "dimensions", header: "Dimensões", accessor: "dimensions", minWidth: 180 },
  { id: "collection", header: "Coleta → Dynatrace", accessor: "collection", minWidth: 220 },
  { id: "usage", header: "Usado no app em", accessor: "usage", minWidth: 150 },
];

const SCREEN_COLUMNS = [
  { id: "element", header: "Elemento da tela", accessor: "element", minWidth: 200 },
  { id: "data", header: "Dado necessário", accessor: "data", minWidth: 300 },
  { id: "source", header: "Fonte no Dynatrace", accessor: "source", minWidth: 280 },
];

const ROLLOUT_COLUMNS = [
  { id: "order", header: "#", accessor: "order", width: 40 },
  { id: "track", header: "Frente", accessor: "track", width: 130 },
  { id: "delivery", header: "Entrega", accessor: "delivery", minWidth: 420 },
];

const VARIANT = { rowSeparation: "horizontalDividers", contained: true, rowDensity: "condensed" } as const;

const PRIORITY_COLOR: Record<Section["priority"], "success" | "primary" | "warning" | "neutral"> = {
  Negócio: "success",
  Integrações: "primary",
  Equipamentos: "warning",
  Externo: "neutral",
};

export const DataIntegrations = () => (
  <div className="ff-about ff-data">
    <Heading level={2}>Dados e integrações</Heading>
    <Paragraph>
      O que precisa ser conectado para o <Strong>Poultry Industry</Strong> rodar com dados reais da planta em vez do simulador: cada evento e métrica, de
      onde vem, como chega ao Dynatrace e onde aparece na tela. Esta versão não executa nenhuma consulta: qualquer DQL escrita a partir deste mapa precisa ser
      executada e medida contra eventos reais antes de entrar no app.
    </Paragraph>

    <Heading level={4}>Caminho dos dados</Heading>
    <div className="ff-layers">
      {LAYERS.map((l, i) => (
        <React.Fragment key={l.name}>
          <div className="ff-layer">
            <strong>{l.name}</strong>
            <span>{l.items}</span>
            <small>{l.collection}</small>
          </div>
          {i < LAYERS.length - 1 && (
            <span className="ff-layer-arrow" aria-hidden>
              →
            </span>
          )}
        </React.Fragment>
      ))}
    </div>

    <Heading level={4}>Convenções</Heading>
    <List>
      <li>
        Business Events com <code>event.provider = &quot;poultry&quot;</code> e <code>event.type</code> iniciando por <code>poultry.</code> (ex.:{" "}
        <code>poultry.livebird.weighed</code>, <code>poultry.load.released</code>, <code>poultry.nfe.result</code>).
      </li>
      <li>
        Métricas com prefixo <code>poultry.</code> e as dimensões comuns <code>plant.id</code>, <code>line</code> e <code>equipment.id</code>.
      </li>
      <li>
        <code>truck.id</code> (aves vivas) e <code>load.id</code> (expedição) são as chaves de correlação do Business Flow.
      </li>
      <li>Nada de XML de NF-e, CNPJ/CPF de terceiros ou placas completas: o OpenPipeline mantém só códigos e hashes.</li>
    </List>

    <Heading level={4}>Campos e métricas por domínio</Heading>
    <Accordion multiple defaultExpanded={["load"]}>
      {SECTIONS.map((s) => (
        <Accordion.Section key={s.id} id={s.id}>
          <Accordion.SectionLabel>
            <span className="ff-acc-label">
              <Chip size="condensed" color={PRIORITY_COLOR[s.priority]}>
                {s.priority}
              </Chip>
              {s.title}
            </span>
          </Accordion.SectionLabel>
          <Accordion.SectionContent>
            <div className="ff-acc-body">
              <Paragraph>{s.summary}</Paragraph>
              {s.fields && <SimpleTable<Field, string> data={s.fields} columns={FIELD_COLUMNS} variant={VARIANT} />}
              {s.metrics && <SimpleTable<Metric, string> data={s.metrics} columns={METRIC_COLUMNS} variant={VARIANT} />}
              {s.notes && (
                <List>
                  {s.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </List>
              )}
            </div>
          </Accordion.SectionContent>
        </Accordion.Section>
      ))}
    </Accordion>

    <Heading level={4}>O que cada elemento da tela consome</Heading>
    <SimpleTable<ScreenMap, string> data={SCREEN_MAP} columns={SCREEN_COLUMNS} variant={VARIANT} />

    <Heading level={4}>Ordem de implantação sugerida</Heading>
    <SimpleTable<Step, string> data={ROLLOUT} columns={ROLLOUT_COLUMNS} variant={VARIANT} />
  </div>
);
