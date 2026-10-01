export type ScenarioId = "heat" | "evisc" | "tunnel" | "storage" | "fgscale" | "sefaz" | "cert";

export interface Entity {
  id: string;
  label: string;
}

export interface ScenarioDef {
  id: ScenarioId;
  key: string;
  name: string;
  summary: string;
  /** Link of the chain where the incident starts. */
  link: string;
  /** Incident duration, in plant minutes. */
  durationMin: number;
  /** Minutes until the effect reaches full strength. */
  rampMin: number;
  /** Plant minutes to go back to normal after the incident ends. */
  recoveryMin: number;
  /** Time to detection (plant minutes). */
  mttdMin: number;
  severity: "critical" | "warning";
  title: string;
  rootCause: string;
  action: string;
  explanation: string;
  entities: Entity[];
}

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: "heat",
    key: "1",
    name: "Calor no galpão de espera",
    summary: "Dia de 34 °C e um banco de ventiladores parado: a mortalidade (DOA) sobe",
    link: "Aves vivas",
    durationMin: 240,
    rampMin: 30,
    recoveryMin: 40,
    mttdMin: 6,
    severity: "critical",
    title: "Galpão de espera: temperatura alta e mortalidade (DOA) subindo",
    rootCause:
      "O inversor do banco de ventiladores V-04 do galpão de espera desarmou às primeiras horas de um dia de 34 °C. " +
      "Sem ventilação, a temperatura das baias passou de 33 °C e a mortalidade das aves que aguardam cresce com o tempo de espera.",
    action:
      "Rearmar o inversor do V-04 (ou ligar o banco reserva), ativar a nebulização máxima e descarregar primeiro os caminhões com maior tempo de espera.",
    explanation:
      "A mortalidade na chegada (DOA) deixou de acompanhar o padrão do horário e subiu em todas as baias ao mesmo tempo. " +
      "Correlacionei a alta com a temperatura do galpão, que subiu 7 °C em 30 minutos, e com o sinal do inversor do banco de ventiladores V-04, " +
      "que parou de reportar rotação. Transporte, granjas de origem e tempo de viagem estão dentro do normal: o problema está no galpão, não na apanha. " +
      "Cada hora de espera nessas condições custa cerca de 0,35% das aves de cada caminhão.",
    entities: [
      { id: "stage:aves", label: "Galpão de espera" },
      { id: "equip:V-04", label: "Ventiladores V-04" },
      { id: "stage:balFV", label: "Balança de frango vivo" },
    ],
  },
  {
    id: "evisc",
    key: "2",
    name: "Contaminação na evisceração",
    summary: "Evisceradora da linha 2 desregulada: contaminação sobe e o SIF reduz a velocidade",
    link: "Linha de abate",
    durationMin: 150,
    rampMin: 8,
    recoveryMin: 25,
    mttdMin: 5,
    severity: "critical",
    title: "Linha 2: contaminação fecal na evisceração e velocidade reduzida pelo SIF",
    rootCause:
      "A bomba de vácuo da evisceradora da linha 2 perdeu pressão; a máquina passou a romper vísceras. " +
      "A contaminação da L2 subiu de 1,2% para cerca de 7% e o SIF determinou a redução da linha para 5.000 aves/h.",
    action:
      "Parar a evisceradora L2 para ajuste da bomba de vácuo e das facas na próxima janela; reforçar o refile na inspeção até a contaminação voltar abaixo de 2%.",
    explanation:
      "As condenações parciais por contaminação da linha 2 subiram cinco vezes em 10 minutos, enquanto a linha 1, com as mesmas aves, seguiu normal. " +
      "Isso descarta o lote e o jejum das aves como causa. A telemetria da evisceradora L2 mostra queda de 18% na pressão de vácuo no mesmo instante. " +
      "Com a redução de velocidade determinada pelo SIF, a planta deixa de abater cerca de 2.500 aves por hora e o rendimento de carcaça cai pelo refile.",
    entities: [
      { id: "line:2", label: "Linha 2" },
      { id: "stage:inspecao", label: "Inspeção SIF" },
      { id: "equip:EVS-2", label: "Evisceradora L2" },
    ],
  },
  {
    id: "tunnel",
    key: "3",
    name: "Compressor de amônia — Túnel 2",
    summary: "Compressor C-3 desarmou: o Túnel 2 aquece, a antecâmara lota e a linha precisa reduzir",
    link: "Congelamento",
    durationMin: 200,
    rampMin: 20,
    recoveryMin: 50,
    mttdMin: 4,
    severity: "critical",
    title: "Túnel 2 fora de temperatura: capacidade de congelamento caiu quase pela metade",
    rootCause:
      "O ventilador do condensador evaporativo CE-2 parou; a pressão de descarga subiu e o compressor de amônia C-3 desarmou por segurança. " +
      "O Túnel 2 aqueceu acima de −28 °C e deixou de receber produto; sem o C-3, os túneis 1 e 3 operam a cerca de −31 °C e congelam mais devagar.",
    action:
      "Religar o compressor reserva C-5, verificar o motor do ventilador do CE-2 e priorizar os túneis 1 e 3; se a antecâmara passar de 80%, desviar caixas para congelamento externo.",
    explanation:
      "A temperatura do Túnel 2 começou a subir 4 minutos depois de um pico de pressão de descarga no compressor C-3, que em seguida desarmou. " +
      "O ventilador do condensador evaporativo CE-2 parou de reportar corrente segundos antes do pico: é a causa raiz. " +
      "Sem o Túnel 2, a capacidade de congelamento fica abaixo da produção; a antecâmara enche e, pela regra de operação, a linha de abate precisa reduzir a velocidade. " +
      "A previsão de lotação da antecâmara está no card.",
    entities: [
      { id: "tunnel:2", label: "Túnel 2" },
      { id: "equip:C-3", label: "Compressor C-3" },
      { id: "stage:ante", label: "Antecâmara" },
      { id: "stage:linha", label: "Linhas de abate" },
    ],
  },
  {
    id: "storage",
    key: "4",
    name: "Navio omitiu escala (câmara lotada)",
    summary: "Começa no 4º dia sem retirada de contêineres: câmara a 98%, túneis travam e a linha reduz",
    link: "Armazenagem",
    durationMin: 240,
    rampMin: 1,
    recoveryMin: 180,
    mttdMin: 8,
    severity: "critical",
    title: "Câmara fria a 98%: armazenagem limitada trava os túneis",
    rootCause:
      "O navio do serviço Oriente Médio omitiu a escala em Paranaguá e os bookings foram rolados: há 4 dias os contêineres de exportação não são retirados. " +
      "A câmara fria chegou a 98% e a armazenagem não acompanha a saída dos túneis.",
    action:
      "Transferir paletes para armazém frigorífico externo, antecipar cargas do mercado interno e renegociar os bookings com o armador.",
    explanation:
      "Os eventos de booking do armador mudaram para ROLLED há 4 dias e, desde então, nenhuma carga de exportação foi agendada. " +
      "A ocupação da câmara fria subiu cerca de 4 pontos por dia até 98%, e a armazenagem passou a ser limitada pela falta de posições livres. " +
      "Com a saída dos túneis travada, a antecâmara enche e a linha precisa reduzir: um problema logístico no porto está parando o abate, a 600 km de distância.",
    entities: [
      { id: "stage:camara", label: "Câmara fria" },
      { id: "stage:tuneis", label: "Túneis" },
      { id: "port", label: "Porto de Paranaguá" },
      { id: "stage:linha", label: "Linhas de abate" },
    ],
  },
  {
    id: "fgscale",
    key: "5",
    name: "Balança de produto acabado sem integração",
    summary: "Os tickets de pesagem não chegam ao ERP: a NF-e não é solicitada e o pátio lota",
    link: "Pesagem",
    durationMin: 90,
    rampMin: 1,
    recoveryMin: 20,
    mttdMin: 3,
    severity: "critical",
    title: "Balança de produto acabado: tickets de pesagem não chegam ao ERP",
    rootCause:
      "O gateway serial-TCP GW-BAL-02, que liga o indicador da balança de produto acabado ao ERP, entrou em ciclo de reinicialização após uma atualização de firmware. " +
      "A pesagem acontece, mas o ticket não é integrado e o faturamento não começa.",
    action:
      "Reverter o firmware do GW-BAL-02; até lá, digitar os tickets manualmente no ERP com dupla conferência (procedimento de contingência).",
    explanation:
      "Os caminhões continuam passando na balança, mas nenhum ticket foi recebido pelo ERP há 3 minutos, contra uma média de um a cada 25 minutos neste horário. " +
      "Os logs do serviço de integração mostram conexões recusadas pelo gateway GW-BAL-02, que reinicia a cada 90 segundos desde a atualização de firmware das 03:10. " +
      "Sem ticket não há NF-e: as cargas pesadas ocupam o pátio e, com ele cheio, os caminhões carregados ficam presos nas docas.",
    entities: [
      { id: "stage:balPA", label: "Balança de produto acabado" },
      { id: "equip:GW-BAL-02", label: "Gateway GW-BAL-02" },
      { id: "stage:portaria", label: "Pátio" },
      { id: "stage:docas", label: "Docas" },
    ],
  },
  {
    id: "sefaz",
    key: "6",
    name: "SEFAZ-PR indisponível",
    summary: "Autorizadora fora do ar (cStat 108/109): cargas retidas até a SEFAZ-PR ativar a SVC-RS (~1h15)",
    link: "Faturamento",
    durationMin: 180,
    rampMin: 1,
    recoveryMin: 15,
    mttdMin: 2,
    severity: "critical",
    title: "SEFAZ-PR indisponível: NF-e não autorizadas, cargas retidas",
    rootCause:
      "A SEFAZ-PR (autorizadora estadual) está fora do ar: as consultas de status retornam cStat 108 e depois 109 (paralisado sem previsão). " +
      "É uma causa externa; ERP, mensageria e certificado estão saudáveis.",
    action:
      "Acompanhar a ativação da SVC-RS pela SEFAZ-PR e emitir em contingência (tpEmis 7) assim que ela estiver ativa — um Workflow do Dynatrace consulta o status e troca a mensageria automaticamente. " +
      "Para emissores do Paraná o EPEC não é aceito a partir de 05/10/2026 (NT 2014.001 v1.40): não há outra saída.",
    explanation:
      "O monitor sintético do serviço de status da SEFAZ-PR falhou em todas as localidades ao mesmo tempo, e as chamadas da mensageria passaram a expirar após 30 s. " +
      "ERP, mensageria, rede e certificado digital estão saudáveis: a causa é a autorizadora estadual. " +
      "Enquanto não há autorização, cada carga pesada fica retida no pátio, e a SVC-RS só pode ser usada depois que a SEFAZ-PR a ativar. " +
      "Um Workflow consulta o status da SVC-RS e troca a mensageria para tpEmis 7 assim que ela responder como ativa; a partir daí a fila drena.",
    entities: [
      { id: "node:sefaz", label: "SEFAZ-PR" },
      { id: "node:svc", label: "SVC-RS" },
      { id: "node:msg", label: "Mensageria NF-e" },
      { id: "stage:portaria", label: "Pátio" },
    ],
  },
  {
    id: "cert",
    key: "7",
    name: "Certificado digital A1 vencido",
    summary: "O e-CNPJ da mensageria venceu: toda NF-e é rejeitada (cStat 281)",
    link: "Faturamento",
    durationMin: 95,
    rampMin: 1,
    recoveryMin: 15,
    mttdMin: 1,
    severity: "critical",
    title: "Todas as NF-e rejeitadas: certificado digital do transmissor vencido (cStat 281)",
    rootCause:
      "O certificado A1 (e-CNPJ) usado pela mensageria para assinar e transmitir as NF-e venceu. " +
      "A SEFAZ rejeita todas as notas com cStat 281 — Certificado Transmissor Data Validade.",
    action:
      "Instalar o certificado renovado no cofre da mensageria e reprocessar as notas rejeitadas. Para o futuro: tratar a previsão de vencimento com um Workflow que abra o chamado 30 dias antes.",
    explanation:
      "A taxa de rejeição da NF-e foi de 0% para 100% no mesmo minuto, sempre com cStat 281. " +
      "O certificado digital da mensageria tinha validade até hoje: a previsão de vencimento já aparecia na Dynatrace Intelligence há 12 dias, mas não foi tratada. " +
      "Enquanto o certificado não é trocado, nenhuma carga sai: toda a expedição está parada, e os contêineres de exportação perdem margem para o cut-off do navio.",
    entities: [
      { id: "node:msg", label: "Mensageria NF-e" },
      { id: "cert", label: "Certificado A1" },
      { id: "stage:nfe", label: "NF-e" },
      { id: "stage:portaria", label: "Pátio" },
    ],
  },
];

export const SCENARIO_BY_ID: Record<ScenarioId, ScenarioDef> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s])) as Record<
  ScenarioId,
  ScenarioDef
>;

/** Forecast shown when the app opens (and until the certificate scenario is played). */
export const CERT_FORECAST = {
  title: "Certificado digital A1 da mensageria NF-e vence em breve",
  rootCause:
    "O certificado e-CNPJ usado para assinar e transmitir as NF-e expira dentro do prazo exibido. Depois disso, toda nota será rejeitada (cStat 281).",
  action: "Renovar o certificado e instalá-lo no cofre da mensageria antes do vencimento; um Workflow pode abrir o chamado automaticamente.",
  explanation:
    "A data de validade do certificado do transmissor aparece nos logs da mensageria a cada conexão com a SEFAZ. " +
    "Nenhuma renovação foi registrada. Se nada for feito, a expedição para no dia do vencimento: é o cenário 7 do painel do apresentador.",
};
