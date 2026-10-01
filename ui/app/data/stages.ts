import type { SparkKey, StageId } from "../sim/types";

export interface StageInfo {
  title: string;
  what: string;
  bottleneck: string;
  source: string;
}

/** What each link of the chain does, how it becomes a bottleneck and where Dynatrace would read it. */
export const STAGE_INFO: Record<StageId, StageInfo> = {
  aves: {
    title: "Aves vivas · galpão de espera",
    what: "Caminhões com cerca de 4.200 aves (≈ 12 t) chegam das granjas integradas com a GTA e aguardam em baias ventiladas e nebulizadas até a descarga. O jejum total recomendado é de 8 a 12 horas.",
    bottleneck: "Galpão vazio para a linha por falta de aves; espera longa ou calor aumentam a mortalidade (DOA) e a perda de peso.",
    source: "Business Events de chegada e pesagem; temperatura, umidade e estado dos ventiladores via OpenTelemetry (CLP do galpão).",
  },
  balFV: {
    title: "Balança de frango vivo",
    what: "Pesa o caminhão cheio na entrada (bruto) e vazio na saída (tara). O peso líquido é a base do rendimento e do acerto com o produtor integrado.",
    bottleneck: "Com o galpão cheio, o caminhão fica preso na plataforma e a fila cresce na estrada; indicador sem integração atrasa o acerto.",
    source: "Tickets do indicador de pesagem (gateway serial-TCP → sistema de integração) como Business Events; logs do gateway.",
  },
  linha: {
    title: "Abate · linhas 1 e 2",
    what: "Pendura, insensibilização, sangria, escaldagem, depenagem, evisceração, inspeção e pré-resfriamento. Cada linha roda até 7.500 aves/h nos turnos 05:00–13:48 e 14:30–23:18.",
    bottleneck: "Reduz por ordem do SIF, por falta de aves ou quando o frio a jusante não absorve a produção (regra da antecâmara).",
    source: "Velocidade da nória, paradas e contadores via OpenTelemetry (CLPs/OPC UA); paradas como eventos.",
  },
  inspecao: {
    title: "Inspeção SIF · condenas",
    what: "Linhas de inspeção A/B/C decidem a condenação total (carcaça inteira) ou parcial (partes). Pré-chiller ≤ 16 °C, chiller ≤ 4 °C, carcaça ≤ 7 °C e absorção ≤ 8% (Portaria 210).",
    bottleneck: "Contaminação alta leva o SIF a reduzir a velocidade; condenas sobem e o rendimento cai pelo refile.",
    source: "Registros de condenação por causa e por linha (sistema de inspeção) como Business Events; telemetria das evisceradoras.",
  },
  embalagem: {
    title: "Cortes, industrializados e embalagem",
    what: "Frango inteiro, peito, coxa, sobrecoxa, asa, coração, miúdos e patas; salsicha, frango a passarinho e empanados. Caixas etiquetadas e pesadas (check-weigher).",
    bottleneck: "Etiquetadoras e esteiras paradas acumulam produto resfriado; o fluxo segue o ritmo da linha com cerca de 90 min de atraso.",
    source: "Eventos de caixa embalada (MES) e estado das etiquetadoras e check-weighers.",
  },
  ante: {
    title: "Antecâmara",
    what: "Pulmão de caixas entre a embalagem e os túneis (1.200 caixas).",
    bottleneck: "Enche quando os túneis não recebem; a regra de operação reduz a linha antes que ela lote.",
    source: "Contagem de caixas por leitura de etiqueta (MES/WMS) como métrica.",
  },
  tuneis: {
    title: "Túneis de congelamento",
    what: "Três túneis contínuos a −35 °C, 13.000 caixas cada, cerca de 18 h até o centro térmico chegar a −18 °C. Refrigeração por amônia com compressores parafuso.",
    bottleneck: "Temperatura alta alonga o congelamento e reduz a capacidade; acima de −28 °C o túnel não recebe produto.",
    source: "Temperaturas, pressões de sucção/descarga e estado dos compressores via OpenTelemetry (supervisório da refrigeração).",
  },
  camara: {
    title: "Câmara fria",
    what: "12.000 posições-palete a −22 °C. Estoque para cargas vendidas no mercado interno e contêineres de exportação.",
    bottleneck: "Perto de 98,5% não há posição livre: a armazenagem só acompanha as retiradas, os túneis travam e a linha reduz.",
    source: "Ocupação e movimentações do WMS como Business Events; temperatura da câmara via OpenTelemetry.",
  },
  docas: {
    title: "Docas e picking",
    what: "Seis docas carregam contêineres reefer 40', carretas, trucks e tocos frigoríficos a partir do picking do WMS.",
    bottleneck: "Caminhão carregado que não consegue ir à balança ou ao pátio fica preso na doca e o picking para.",
    source: "Eventos de início/fim de carregamento (WMS) e sensores de doca.",
  },
  balPA: {
    title: "Balança de produto acabado",
    what: "Tara na entrada e peso bruto depois do carregamento. O ticket integrado ao ERP libera o faturamento; divergências acima de ~0,5% exigem conferência.",
    bottleneck: "Sem integração do ticket o ERP não fatura: as cargas pesadas ocupam o pátio.",
    source: "Tickets de pesagem como Business Events; logs e disponibilidade do gateway da balança.",
  },
  nfe: {
    title: "NF-e · SEFAZ-PR",
    what: "O ERP gera a nota, a mensageria assina com o certificado A1 e transmite à SEFAZ-PR; só com cStat 100 a carga pode sair. Contingência: SVC-RS (tpEmis 7), ativada pela SEFAZ-PR. O EPEC deixa de valer para o Paraná em 05/10/2026.",
    bottleneck: "SEFAZ fora do ar (cStat 108/109) ou certificado vencido (cStat 281) param a expedição inteira.",
    source: "Traces do ERP e da mensageria (OneAgent), logs com cStat, monitor sintético do serviço de status e Business Events por NF-e.",
  },
  portaria: {
    title: "Pátio e portaria",
    what: "Dez vagas para caminhões aguardando doca ou documentação; a portaria confere NF-e, DANFE e MDF-e e libera a saída.",
    bottleneck: "Pátio cheio de cargas sem NF-e prende os caminhões carregados nas docas.",
    source: "Eventos de entrada e saída da portaria (controle de acesso) como Business Events.",
  },
};

export interface KpiInfo {
  title: string;
  what: string;
  thresholds: string;
  spark: SparkKey;
}

export const KPI_INFO: Record<string, KpiInfo> = {
  health: {
    title: "Saúde da cadeia",
    what: "Índice 0–100: aves vivas 15%, linha 20%, qualidade 15%, frio 15%, armazenagem 10%, expedição 10% e NF-e 15%.",
    thresholds: "OK ≥ 90 · atenção ≥ 75 · crítico < 75",
    spark: "health",
  },
  birds: {
    title: "Aves abatidas hoje",
    what: "Aves penduradas no dia de produção (03:00 às 03:00, fuso do visitante), comparadas ao plano diário do PCP até a hora atual.",
    thresholds: "OK até 2% (ou 15 min de abate) abaixo do plano · atenção até 5% (ou 30 min) · crítico abaixo disso",
    spark: "birds",
  },
  line: {
    title: "Ritmo do abate",
    what: "Aves por hora nas duas linhas, comparadas ao plano de 15.000 aves/h durante os turnos.",
    thresholds: "OK ≥ 85% · atenção ≥ 70% · crítico < 70%, na média de ~10 min (microparadas de 2–7 min são normais)",
    spark: "line",
  },
  yield: {
    title: "Rendimento de carcaça",
    what: "Carcaça resfriada, depois do refile de condenação parcial, sobre o peso vivo pendurado (janela móvel de 40 min).",
    thresholds: "OK ≥ 73,5% · atenção ≥ 72,5% · crítico < 72,5%",
    spark: "yield",
  },
  condemn: {
    title: "DOA + condenação total",
    what: "Aves mortas na chegada ou na espera e carcaças condenadas inteiras, sobre as aves recebidas (janela de 60 min). Métrica de perda: nunca aparece em verde.",
    thresholds: "neutro ≤ 0,8% · atenção ≤ 1,5% · crítico > 1,5%",
    spark: "condemn",
  },
  storage: {
    title: "Câmara fria",
    what: "Ocupação das 12.000 posições-palete. Acima de 98,5% não há posição livre.",
    thresholds: "OK < 90% · atenção < 95% · crítico ≥ 95%",
    spark: "storage",
  },
  finished: {
    title: "Produto acabado hoje",
    what: "Toneladas embaladas no dia de produção (03:00 às 03:00): as caixas do turno 2 embaladas depois da meia-noite contam no dia em que as aves foram abatidas.",
    thresholds: "Sem limiar",
    spark: "finished",
  },
  shipped: { title: "Expedido hoje", what: "Toneladas que passaram pela portaria com NF-e autorizada.", thresholds: "Sem limiar", spark: "shipped" },
  nfe: {
    title: "NF-e · autorização",
    what: "Tempo de autorização (p95 das últimas 60 notas) e estado da autorizadora.",
    thresholds: "OK p95 ≤ 3 s · atenção em contingência · crítico com SEFAZ fora do ar ou rejeições",
    spark: "nfe",
  },
};
