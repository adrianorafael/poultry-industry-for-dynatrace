/**
 * Data map to run Poultry Industry on real data instead of the simulator.
 * Conventions: Business Events `event.provider = "poultry"` / `event.type = poultry.*`,
 * metrics `poultry.*`, common dimensions `plant.id`, `line`, `equipment.id`.
 */

export interface Layer {
  name: string;
  items: string;
  collection: string;
}

/** Path of the data, from the plant floor to Dynatrace. */
export const LAYERS: Layer[] = [
  {
    name: "Chão de fábrica (OT)",
    items: "CLPs das linhas, evisceradoras, supervisório da refrigeração (amônia), sensores do galpão e da câmara, indicadores de pesagem",
    collection: "OPC UA / Modbus TCP lidos por um OpenTelemetry Collector na rede industrial",
  },
  {
    name: "Sistemas de planta",
    items: "PCP / APS (plano de produção), sistema de integração avícola, MES, sistema de inspeção (SIF), WMS da câmara e das docas, controle de portaria",
    collection: "Eventos publicados como Business Events (API de ingestão) ou lidos de logs",
  },
  {
    name: "Sistemas corporativos",
    items: "ERP (faturamento), mensageria NF-e, integração com armadores e Portal Único (DU-E)",
    collection: "OneAgent nos hosts e serviços: traces, logs e métricas; Business Events por nota",
  },
  {
    name: "Serviços externos",
    items: "SEFAZ-PR (autorizadora), SVC-RS (contingência), APIs dos armadores",
    collection: "Monitores sintéticos + chamadas de saída observadas nos traces",
  },
  {
    name: "Dynatrace",
    items: "OpenPipeline, Grail, Business Flow, Dynatrace Intelligence, Workflows, dashboards e este app",
    collection: "Business Events, métricas, logs, traces e eventos correlacionados",
  },
];

export interface Field {
  field: string;
  type: string;
  example: string;
  producer: string;
  usage: string;
}

export interface Metric {
  metric: string;
  unit: string;
  dimensions: string;
  collection: string;
  usage: string;
}

export interface Section {
  id: string;
  title: string;
  priority: "Negócio" | "Integrações" | "Equipamentos" | "Externo";
  summary: string;
  fields?: Field[];
  metrics?: Metric[];
  notes?: string[];
}

export const SECTIONS: Section[] = [
  {
    id: "livebird",
    title: "Aves vivas: caminhão, pesagem e galpão",
    priority: "Negócio",
    summary: "Um evento por marco do caminhão de aves vivas, ligados pelo truck.id (e pela GTA).",
    fields: [
      { field: "event.type", type: "string", example: "poultry.livebird.weighed", producer: "Sistema de integração", usage: "Balança FV, gargalos" },
      { field: "truck.id / gta.number", type: "string", example: "FV-231 / 41.001234", producer: "Logística de apanha", usage: "Jornada do caminhão" },
      { field: "farm.id", type: "string", example: "Integrado 214", producer: "Sistema de integração", usage: "Detalhes, acerto" },
      { field: "weighing.kind", type: "gross | tare", example: "gross", producer: "Indicador → gateway", usage: "Balança FV" },
      { field: "weight.kg", type: "number", example: "28460", producer: "Indicador de pesagem", usage: "Peso vivo, rendimento" },
      { field: "birds.loaded / birds.doa", type: "number", example: "4200 / 7", producer: "Sistema de integração", usage: "DOA" },
      { field: "shed.bay / shed.in / unload.start", type: "number / timestamp", example: "5 / 10:02 / 11:14", producer: "Controle do galpão", usage: "Espera, baias" },
    ],
  },
  {
    id: "line",
    title: "Abate, inspeção e rendimento",
    priority: "Negócio",
    summary: "Paradas de linha, condenações por causa e fechamento de rendimento por lote.",
    fields: [
      { field: "event.type", type: "string", example: "poultry.line.stop", producer: "MES", usage: "Ritmo do abate" },
      { field: "line / reason / duration.s", type: "string / number", example: "L2 / ordem SIF / 1800", producer: "MES", usage: "Gargalos" },
      { field: "event.type", type: "string", example: "poultry.inspection.condemnation", producer: "Sistema de inspeção", usage: "Condenas" },
      { field: "condemnation.kind / cause", type: "string", example: "partial / contaminação", producer: "Agentes de inspeção", usage: "Causas (TopList)" },
      { field: "event.type", type: "string", example: "poultry.lot.yield", producer: "MES", usage: "Rendimento de carcaça" },
      { field: "live.kg / carcass.kg / trim.kg", type: "number", example: "11970 / 8846 / 78", producer: "MES + balanças", usage: "Balanço de massa" },
    ],
  },
  {
    id: "pcp",
    title: "Plano de produção do PCP",
    priority: "Negócio",
    summary:
      "O calendário diário do PCP (aves e kg por dia de produção) vira uma tabela de lookup no Grail; a aprovação de hora extra e de dia extra vira evento. O realizado vem dos eventos de abate e de embalagem.",
    fields: [
      { field: "event.type", type: "string", example: "poultry.plan.day", producer: "PCP / APS (ou ERP)", usage: "Calendário, meta do mês" },
      { field: "plan.date / day.kind", type: "date / string", example: "2026-09-23 / util", producer: "PCP", usage: "Calendário" },
      { field: "plan.birds / plan.kg", type: "number", example: "255000 / 573800", producer: "PCP (programação de abate do fomento)", usage: "Aderência, projeção" },
      { field: "event.type", type: "string", example: "poultry.plan.overtime.approved", producer: "PCP (ou Workflow)", usage: "Hora extra, dia extra" },
      { field: "overtime.h / extra.day", type: "number / date", example: "0.75 / 2026-09-26", producer: "PCP + RH", usage: "Recuperação" },
      { field: "event.type", type: "string", example: "poultry.bird.hung (somado por hora)", producer: "MES", usage: "Realizado × plano por hora" },
    ],
    notes: [
      "Dia de produção de 03:00 a 03:00: o turno 2, a hora extra e as caixas embaladas depois da meia-noite contam no dia em que o abate começou.",
      "Hora extra: até 2 h por dia (CLT, art. 59), com adicional mínimo de 50%. Dia extra: um turno no sábado, quando o déficit passa do que a hora extra cobre.",
      "Workflow 4: quando a projeção do dia ficar abaixo do plano, avisar o PCP e o fomento (escala de apanha e transporte) com a hora extra sugerida.",
    ],
  },
  {
    id: "cold",
    title: "Embalagem, túneis e câmara fria",
    priority: "Negócio",
    summary: "Caixa embalada, entrada e saída de túnel, armazenagem e retirada de paletes.",
    fields: [
      { field: "event.type", type: "string", example: "poultry.box.packed", producer: "MES / etiquetadora", usage: "Produto acabado" },
      { field: "product.id / box.kg", type: "string / number", example: "sobrecoxa / 18.0", producer: "MES", usage: "Mix de produtos" },
      { field: "event.type", type: "string", example: "poultry.tunnel.loaded / unloaded", producer: "Supervisório / WMS", usage: "Túneis" },
      { field: "event.type", type: "string", example: "poultry.pallet.stored / picked", producer: "WMS", usage: "Câmara fria, docas" },
      { field: "storage.occupancy.pct", type: "number", example: "80.4", producer: "WMS", usage: "KPI câmara fria" },
    ],
  },
  {
    id: "load",
    title: "Expedição: carga, balança e portaria",
    priority: "Negócio",
    summary: "O load.id é a correlação do Business Flow de expedição: da chegada do veículo à saída (e ao porto, na exportação).",
    fields: [
      { field: "event.type", type: "string", example: "poultry.load.arrived / docked / loaded / weighed / released", producer: "WMS + portaria + balança", usage: "Docas, pátio, jornada" },
      { field: "load.id / vehicle.type", type: "string", example: "CG-014 / container", producer: "WMS", usage: "Cargas do dia" },
      { field: "market / destination", type: "string", example: "EXP / JP", producer: "ERP (pedido)", usage: "Vendas e expedição" },
      { field: "weight.gross.kg / divergence.pct", type: "number", example: "41120 / 0.2", producer: "Balança PA", usage: "Conferência" },
      { field: "ticket.integrated", type: "boolean", example: "true", producer: "Integração balança → ERP", usage: "Cenário 5" },
      { field: "booking.status / cutoff", type: "string / timestamp", example: "CONFIRMED / 03/10 18:00", producer: "API do armador", usage: "Cut-off, cenário 4" },
    ],
  },
  {
    id: "nfe",
    title: "Faturamento: NF-e",
    priority: "Integrações",
    summary: "Um evento por tentativa de autorização. Nunca ingerir o XML completo nem dados pessoais: só chave, número, cStat e tempos.",
    fields: [
      { field: "event.type", type: "string", example: "poultry.nfe.result", producer: "Mensageria NF-e", usage: "Faturamento, KPI NF-e" },
      { field: "nfe.number / nfe.key", type: "string", example: "000128450 / 4126…", producer: "Mensageria", usage: "Lista de NF-e" },
      { field: "cstat / xmotivo", type: "number / string", example: "100 / Autorizado o uso da NF-e", producer: "SEFAZ (resposta)", usage: "Rejeições, cenários 6 e 7" },
      { field: "tp.emis", type: "number", example: "1 (normal) · 7 (SVC-RS)", producer: "Mensageria", usage: "Contingência" },
      { field: "latency.ms / authorizer", type: "number / string", example: "910 / SEFAZ-PR", producer: "Mensageria", usage: "p95 de autorização" },
      { field: "cfop / load.id", type: "string", example: "7101 / CG-014", producer: "ERP", usage: "Correlação com a carga" },
    ],
    notes: [
      "O monitor sintético do serviço de status (NFeStatusServico) da SEFAZ-PR e da SVC-RS exige certificado de cliente: use uma localização privada com o certificado no cofre de credenciais.",
      "A validade do certificado A1 da mensageria deve virar evento/métrica diária para a previsão de vencimento.",
      "Para emissores do Paraná o EPEC não é aceito a partir de 05/10/2026 (NT 2014.001 v1.40): a contingência depende da ativação da SVC-RS pela SEFAZ-PR.",
    ],
  },
  {
    id: "ot",
    title: "Equipamentos (métricas OT)",
    priority: "Equipamentos",
    summary: "Métricas coletadas por um OpenTelemetry Collector na rede industrial (OPC UA / Modbus) e enviadas por OTLP.",
    metrics: [
      { metric: "poultry.shed.temperature / humidity", unit: "°C / %", dimensions: "plant.id, zone", collection: "OTel Collector (CLP do galpão)", usage: "Galpão, cenário 1" },
      { metric: "poultry.shed.fan.running", unit: "0/1", dimensions: "equipment.id (V-01…V-04)", collection: "OTel Collector", usage: "Ventilação" },
      { metric: "poultry.line.speed", unit: "aves/h", dimensions: "line", collection: "OTel Collector (CLP da nória)", usage: "Ritmo do abate" },
      { metric: "poultry.evisc.vacuum", unit: "kPa", dimensions: "line, equipment.id", collection: "OTel Collector", usage: "Cenário 2" },
      { metric: "poultry.tunnel.temperature", unit: "°C", dimensions: "tunnel", collection: "Supervisório da refrigeração", usage: "Túneis" },
      { metric: "poultry.nh3.compressor.discharge_pressure / running", unit: "bar / 0/1", dimensions: "equipment.id (C-1…C-5)", collection: "Supervisório", usage: "Cenário 3" },
      { metric: "poultry.coldstore.temperature", unit: "°C", dimensions: "chamber", collection: "Supervisório", usage: "Câmara fria" },
      { metric: "poultry.scale.gateway.up", unit: "0/1", dimensions: "scale (FV, PA)", collection: "OTel Collector (sonda TCP)", usage: "Cenário 5" },
    ],
  },
  {
    id: "flow",
    title: "Business Flow e automação",
    priority: "Externo",
    summary: "Dois fluxos no app Business Flow do Dynatrace: aves vivas (truck.id) e expedição (load.id).",
    notes: [
      "Fluxo Aves vivas: chegada → pesagem bruta → baia → descarga → tara. KPI: tempo de espera e DOA por caminhão.",
      "Fluxo Expedição: chegada → tara → doca → carregado → pesagem bruta → ticket no ERP → NF-e autorizada → portaria. KPI: tempo até a saída e faturamento.",
      "Workflow 1: quando o status da SVC-RS responder como ativa durante uma queda da SEFAZ-PR, trocar a mensageria para tpEmis 7 e avisar a expedição.",
      "Workflow 2: previsão de vencimento do certificado A1 a 30 dias abre chamado para a TI.",
      "Workflow 3: previsão de antecâmara acima de 80% avisa a produção antes de a linha precisar reduzir.",
    ],
  },
];

export interface ScreenMap {
  element: string;
  data: string;
  source: string;
}

export const SCREEN_MAP: ScreenMap[] = [
  { element: "KPIs do topo", data: "Contagens e somas do dia; janelas móveis de rendimento e condenas", source: "DQL sobre bizevents poultry.* (Grail)" },
  { element: "Planta animada", data: "Estado atual de caminhões, docas, túneis e câmara", source: "Último evento por truck.id / load.id + métricas OT" },
  { element: "Plano PCP", data: "Plano diário × realizado; aderência, projeção do dia e do mês; recomendação de hora/dia extra", source: "Lookup do calendário do PCP + poultry.bird.hung e poultry.box.packed por dia de produção" },
  { element: "Gargalos da cadeia", data: "Utilização e estado de cada elo; restrição atual", source: "Business Flow + métricas de capacidade" },
  { element: "Balança FV e galpão", data: "Tickets recentes; baias; temperatura", source: "poultry.livebird.weighed + poultry.shed.*" },
  { element: "Rendimento e condenas", data: "Balanço de massa; causas por linha", source: "poultry.lot.yield + poultry.inspection.condemnation" },
  { element: "Faturamento NF-e", data: "cStat, tpEmis, latência; status das autorizadoras", source: "poultry.nfe.result + Synthetic + traces da mensageria" },
  { element: "Expedição e vendas", data: "Cargas, destinos, valores, cut-off", source: "poultry.load.* + API do armador" },
  { element: "Dynatrace Intelligence", data: "Problemas, causa raiz, previsões", source: "Dynatrace Intelligence (davis problems)" },
];

export interface Step {
  order: string;
  track: string;
  delivery: string;
}

export const ROLLOUT: Step[] = [
  { order: "1", track: "Expedição", delivery: "Business Events de carga e NF-e + monitor sintético da SEFAZ: o gargalo mais caro e o mais fácil de instrumentar." },
  { order: "2", track: "Faturamento", delivery: "OneAgent no ERP e na mensageria; evento de validade do certificado; Workflow da contingência SVC-RS." },
  { order: "3", track: "Frio", delivery: "Supervisório da refrigeração e WMS da câmara: túneis, compressores e ocupação." },
  { order: "4", track: "Abate e plano", delivery: "OTel Collector com OPC UA nos CLPs das linhas e evisceradoras; condenações do sistema de inspeção; calendário do PCP como lookup." },
  { order: "5", track: "Aves vivas", delivery: "Tickets da balança de frango vivo e sensores do galpão; Business Flow de ponta a ponta." },
];

