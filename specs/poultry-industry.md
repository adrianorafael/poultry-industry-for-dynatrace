# Pesquisa e planejamento — Poultry Industry for Dynatrace

**Status:** implemented (versão `0.1.0`)
**Data:** 2026-09-30 · atualizado em 2026-10-01 (plano do PCP, hora extra e dia extra)
**App:** `Poultry Industry for Dynatrace` (nome no produto: `Poultry Industry`, id `my.poultry.industry`)
**Versão:** `0.1.0` — primeira versão (pré-1.0: app de demonstração)
**Aprovação:** o dono pediu, em uma única instrução, para *pesquisar, planejar, documentar em
Markdown e então criar o app a partir deste documento* (2026-09-30). Registrado como
**aprovado sem revisão intermediária** (padrão R5: "just build it" é uma resposta válida).

Este documento tem duas partes. A **Parte A** é a pesquisa: como a cadeia do frango funciona,
quais são os números de referência, onde nascem os gargalos e como o Dynatrace observaria cada
etapa. A **Parte B** é o planejamento (spec) do app que foi construído a partir dela.

---

## Parte A — Pesquisa

### A1. A cadeia verticalizada, da granja ao cliente

A avicultura de corte brasileira é **integrada verticalmente**: a empresa (integradora) é dona das
matrizes, do incubatório, da fábrica de ração, das aves alojadas nos produtores integrados, do
frigorífico, da logística e da venda. O app se concentra na etapa final e mais visível — o
**frigorífico** — mas nasce do elo anterior (a apanha nas granjas) e termina no cliente (mercado
interno ou exportação).

| # | Etapa | O que acontece | Unidade natural | Dependências críticas |
| --- | --- | --- | --- | --- |
| 1 | **Apanha e transporte** | Aves em jejum (8–12 h no total) são carregadas em gaiolas; o caminhão viaja com a **GTA** (Guia de Trânsito Animal, obrigatória) | caminhões/h, aves por carga | Programação de apanha, clima, estradas |
| 2 | **Balança de frango vivo** | Pesagem **bruta** na chegada e **tara** na saída → peso líquido vivo. Base do acerto com o integrado e do cálculo de rendimento | kg vivos, tickets | Indicador da balança, integração com ERP/sistema de integração |
| 3 | **Galpão de espera** | Caminhões aguardam sob ventilação e nebulização. Espera longa ou calor → mortalidade (DOA) e perda de peso | caminhões na baia, tempo de espera | Ventiladores, nebulizadores, temperatura/umidade |
| 4 | **Descarga e pendura** | Aves penduradas nos ganchos da nória; velocidade da linha define o ritmo da planta | aves/h | Operadores, nória |
| 5 | **Insensibilização, sangria, escaldagem, depenagem** | Sequência fixa; falhas geram condenação (escaldagem excessiva, sangria inadequada) | aves/h | Equipamentos, temperatura do escaldador |
| 6 | **Evisceração e inspeção (SIF)** | Linhas de inspeção A/B/C; **condenação total** (carcaça inteira) ou **parcial** (partes) | % condenado, causas | Regulagem da evisceradora, agentes do SIF |
| 7 | **Pré-chiller / chiller** | Resfriamento em água (pré-chiller ≤ 16 °C, chiller ≤ 4 °C, carcaça ≤ 7 °C, absorção ≤ 8%) | carcaças/h, °C | Água gelada, amônia |
| 8 | **Cortes, desossa e industrializados** | Frango inteiro, peito, coxa, sobrecoxa, asa, coração, miúdos, patas; salsicha, frango a passarinho, empanados | t/h, mix | Mão de obra, máquinas de corte |
| 9 | **Embalagem** | Caixas etiquetadas e pesadas (check-weigher) | caixas/h | Etiquetadoras, esteiras |
| 10 | **Túnel de congelamento** | Túnel ≤ −30 °C (−35 °C típico) até o centro térmico chegar a −18 °C | caixas em processo, °C, horas | Compressores de amônia, condensadores |
| 11 | **Câmara fria (estocagem)** | Paletes a −18 °C ou menos (−20 a −25 °C comum) | posições-palete, ocupação | Frio, WMS, espaço |
| 12 | **Picking e carregamento (docas)** | Separação das cargas vendidas e carregamento de contêineres e carretas frigoríficas | cargas/dia, docas ocupadas | WMS, empilhadeiras, agendamento |
| 13 | **Balança de produto acabado** | Tara na entrada e peso bruto após o carregamento; divergência contra o pedido bloqueia a saída | tickets, kg | Indicador da balança, integração com ERP |
| 14 | **Faturamento (NF-e)** | ERP gera a nota; a mensageria assina e transmite; a **SEFAZ** autoriza (cStat 100) | NF-e/h, tempo de autorização | ERP, mensageria, certificado digital, SEFAZ |
| 15 | **Portaria e transporte** | Veículo sai com NF-e/DANFE (e MDF-e); exportação segue ao porto com **DU-E** vinculada à chave da NF-e | cargas, t, destinos | Transportadoras, porto, navio (cut-off) |

**Duas balanças, dois mundos.** A balança de frango vivo alimenta o **rendimento** e o **acerto
com o integrado**; a balança de produto acabado alimenta o **faturamento**. As duas são pontos
únicos de falha com integração a sistemas (ERP / sistema de integração avícola), e o app as
trata como elementos de primeira classe.

### A2. Números de referência do setor (Brasil)

| Indicador | Valor | Fonte |
| --- | --- | --- |
| Produção brasileira de carne de frango (2025) | 15,289 milhões t | ABPA via [Agrolink](https://www.agrolink.com.br/noticias/abpa-consolida-dados-de-2025-e-confirma-brasil-como-potencia-global-em-proteina-animal_514575.html) |
| Exportação (2025) | 5,324 milhões t (+0,6% vs 2024), US$ 9,8 bi | ABPA via [Safras](https://safras.com.br/exportacoes-de-carne-de-frango-confirmam-projecoes-positivas-e-fecham-2025-com-alta-de-06-abpa/) |
| Principal destino (2025) | Emirados Árabes Unidos, 479,9 mil t | idem |
| Ranking jan–nov/2025 | EAU 433,8 · Japão 367,4 · Arábia Saudita 362,6 · África do Sul 288,6 · México 238,2 (mil t) | ABPA via [Notícias Agrícolas](https://www.noticiasagricolas.com.br/noticia/412107) |
| China | Suspendeu compras após caso de IAAP (mai/2025) e **retirou a proibição em 07/11/2025** | [DGABC](https://www.dgabc.com.br/Noticia/4267915/china-retira-proibicao-de-importacao-sobre-frango-brasileiro-apos-gripe-aviaria) · [Band](https://www.band.com.br/agro/noticias/china-reabre-importacoes-de-carne-de-frango-do-brasil-202511081409) |
| Patas (pés) | 91 mil t exportadas à Ásia no 1º sem/2025 (80% China), US$ 252 mi | [Band](https://www.band.com.br/agro/noticias/pes-de-galinha-brasil-exporta-iguaria-valorizada-pela-china-202510241622) |
| Porto de Paranaguá (TCP) | 46.006 contêineres de frango congelado no 1º sem/2023; maior pátio reefer da América do Sul | [Acionista](https://acionista.com.br/em-6-meses-exportacao-de-frango-congelado-ultrapassa-46-mil-conteineres-na-tcp/) |
| Carga de frango vivo | ~12 t e ~4.000 aves por caminhão (≈ 9 aves/gaiola) | [UNESP](https://revistas.fca.unesp.br/index.php/energia/article/download/3693/2607/16255) |
| Mortalidade no transporte (DOA) | 0,13–0,15% nos melhores horários de carregamento | idem |
| Jejum pré-abate | 8 a 12 h (granja + apanha + transporte + espera); > 12 h aumenta contaminação e reduz rendimento | [Aviagen — Manejo pré-abate](https://aviagen-na.aviagen.com/assets/Tech_Center/BB_Foreign_Language_Docs/Portuguese/Manejo-de-pr-abate-em-frangos-de-corte.pdf) |
| Condenação total / parcial | 0,31% total e 8,38% parcial em 49,5 milhões de frangos abatidos | [RBCV/UFF](https://periodicos.uff.br/rbcv/article/download/6879/pdf/30864) |
| Principais causas (parcial) | aerossaculite, contaminação (fecal/biliar), lesão de pele (dermatose), contusão/fratura | idem · [UTFPR](https://periodicos.utfpr.edu.br/rbta/article/download/16298/10016) |
| Principais causas (total) | aspecto repugnante, escaldagem excessiva, caquexia, sangria inadequada, contaminação, ascite | idem |
| Pré-resfriamento (Portaria 210/1998) | pré-chiller ≤ 16 °C (≤ 30 min), chiller ≤ 4 °C, carcaça ≤ 7 °C, absorção de água ≤ 8% | [Agrodefesa GO — PAC 17](https://goias.gov.br/agrodefesa/wp-content/uploads/sites/49/1969/12/1_-pac-17-programa-de-prevencao-e-controle-de-absorcao-de-Agua-ppcaap-c20.pdf) |
| Túnel e estocagem | túnel ≤ −30 °C; câmara de estocagem < −18 °C | [IN SIM Pelotas](https://sistema.pelotas.com.br/transparencia/arquivos/Instrucao%20normativa%20SIM%20numero%2007.pdf) · [IFSC](https://wiki.sj.ifsc.edu.br/images/5/57/Palestracastro.pdf) |
| Refrigeração | amônia com compressores parafuso para túneis (IQF, contínuo, estático) e câmaras | [UTFPR](https://riut.utfpr.edu.br/jspui/bitstream/1/15114/1/PB_DAMEC_2018_2_18.pdf) |
| Capacidade de plantas | plantas brasileiras de 140 mil a ~500 mil aves/dia | [Notícias Agrícolas](https://www.noticiasagricolas.com.br/noticia/259032) |

> **Nota de honestidade.** Nesta sessão os sites oficiais (ABPA, Portal da NF-e, docs.dynatrace.com,
> developer.dynatrace.com) estavam bloqueados para leitura direta pelo proxy de rede. Os números
> acima vêm de resultados de busca que citam essas fontes; os links apontam para as páginas
> citadas. Antes de usar os números em material comercial, confira a fonte primária.

### A3. Rendimento: do peso vivo ao produto acabado

O "rendimento" é o quanto de produto sai de cada quilo vivo pesado na balança de entrada.
Modelo usado no app (valores típicos, arredondados):

| Destino | % do peso vivo | Observação |
| --- | --- | --- |
| DOA + condenação total | ~0,5% das aves | Descartados antes/depois do abate |
| Sangue, penas, cabeça, vísceras não comestíveis | ~17,6% | Graxaria (farinhas e óleo) |
| Refile de condenação parcial | ~0,9% | Partes removidas pela inspeção |
| **Carcaça resfriada** (rendimento de carcaça) | **~73,9%** | KPI principal; cai com contaminação |
| Patas | ~3,9% | Quase tudo exportado para a Ásia |
| Miúdos (coração, fígado, moela) | ~3,7% | Mercado interno e exportação |

A carcaça vira **frango inteiro** (griller para o Oriente Médio) ou **cortes** (peito, coxa,
sobrecoxa, asa); o dorso e os aparos vão para **industrializados** (salsicha, frango a
passarinho, empanados). Estudos brasileiros medem cortes de ~40% de peito, ~31% de coxa e
sobrecoxa e ~10% de asa sobre a carcaça ([Embrapa](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1014046/1/final7594.pdf)).

### A4. Faturamento: NF-e, SEFAZ e contingência

| Fato | Detalhe | Fonte |
| --- | --- | --- |
| Autorização | A NF-e só é válida após o **cStat 100 — Autorizado o uso da NF-e** | Manual da NF-e (via [Buscador NCM](https://buscadorncm.com.br/nfe/rejeicoes)) |
| SEFAZ fora do ar | **cStat 108** (paralisado momentaneamente) e **cStat 109** (paralisado sem previsão) | [Contmatic](https://simplifique.contmatic.com.br/blogs/nfe-contingencia) |
| Contingência | **SVC-AN**, **SVC-RS**, **EPEC** (NF-e completa em até 168 h após o restabelecimento) e **FS-DA** | idem · [Inventti](https://inventti.com.br/?p=12362) |
| Paraná | Autorizadora própria (SEFAZ-PR); contingência pela **SVC-RS**, `tpEmis = 7`; a nota autorizada na SVC já tem status final | [Senior](https://documentacao.senior.com.br/documentoseletronicos/5.8.16/html_ajuda/fluxo-contingencia.htm) · [ACBr](https://www.projetoacbr.com.br/forum/topic/49711-como-e-quando-usar-o-svc-sefaz-virtual-de-conting%C3%AAncia/) |
| Ativação da SVC | A SVC **depende de ativação pela SEFAZ de origem**; o EPEC fica sempre disponível ao contribuinte (quando a própria infraestrutura funciona) | [Tecnospeed](https://blog.tecnospeed.com.br/?p=11479) · [Oobj](https://oobj.com.br/bc/como-funciona-emissao-epec/) |
| **EPEC no Paraná** | A **NT 2014.001 v1.40** cria a regra 2P10-20, que rejeita EPEC de chaves iniciadas por 41 (PR) e 25 (PB) — em produção a partir de **05/10/2026** (Convênio SINIEF 25/2026) | [Inventti](https://inventti.com.br/?p=24895) · [Contábeis](https://www.contabeis.com.br/noticias/78363/epec-sera-bloqueado-para-contribuintes-do-pr-e-pb/) |
| Certificado digital | **cStat 280** (certificado inválido) e **cStat 281** (certificado fora da validade) | [Oobj](https://oobj.com.br/bc/rejeicao-281-como-resolver/) · [Omie](https://ajuda.omie.com.br/pt-BR/articles/6633173-281-rejeicao-certificado-transmissor-data-validade) |
| Duplicidade | **cStat 539** — duplicidade com diferença na chave de acesso | [Senior](https://suporte.senior.com.br/hc/pt-br/articles/26557047318036) |
| Exportação | A **DU-E** (Portal Único Siscomex) é elaborada a partir da **chave de acesso da NF-e** de exportação | [Fazcomex](https://www.fazcomex.com.br/blog/due-o-guia-definitivo/) · [Siscomex](https://www.gov.br/siscomex/pt-br/arquivos-e-imagens/2019/10/Cartilha-Nova-Exportacao-Final.pdf) |
| Aves vivas | A **GTA** acompanha todo trânsito de aves para abate (e-GTA no Paraná, ADAPAR) | [ADAPAR](https://www.adapar.pr.gov.br/Pagina/Transito-Animal) · [MAPA](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/transito-animal/arquivos-transito-nacional-manuais/manual_gta_aves_de_producao_11-0.pdf) |

**Consequência para uma planta no Paraná.** Com o EPEC vedado a partir de 05/10/2026, uma queda da
SEFAZ-PR só tem uma saída: esperar que a própria SEFAZ-PR ative a SVC-RS. O tempo até essa ativação vira
tempo de caminhão parado no pátio — e é exatamente o que o cenário 6 mostra.

**Por que isso importa para a produção.** Sem NF-e autorizada o caminhão carregado **não sai**.
Ele ocupa uma vaga no pátio; com o pátio cheio, os caminhões carregados ficam **presos nas
docas**; sem doca livre, o **picking para**; sem saída, a **câmara fria enche**; com a câmara
cheia, os **túneis não descarregam**; com os túneis travados, a **antecâmara lota**; e a
**linha de abate precisa reduzir a velocidade** — enquanto caminhões de aves vivas continuam
chegando ao **galpão de espera**. Uma falha puramente digital (SEFAZ, certificado, integração da
balança) vira, horas ou dias depois, um problema físico e de bem-estar animal.

### A5. Onde nascem os gargalos (e como se propagam)

```
 aves vivas ─► balança FV ─► galpão ─► LINHA ─► cortes/embalagem ─► antecâmara ─► TÚNEIS ─► CÂMARA ─► docas ─► balança PA ─► NF-e ─► portaria
                                        ▲                               ▲             ▲         ▲         ▲                     │
                                        └────────── contrapressão (back-pressure) quando um estágio a jusante trava ─────────────┘
```

| Gargalo | Sintoma primeiro | Propagação | Tempo típico |
| --- | --- | --- | --- |
| Atraso de aves vivas | galpão vazio | linha **para por falta de aves** (a jusante) | minutos |
| Calor / ventilação do galpão | temperatura do galpão sobe | **DOA** e perda de peso sobem; bem-estar | 30–60 min |
| Evisceradora desregulada | contaminação sobe | SIF **reduz a velocidade**; condenas ↑; rendimento ↓ | 10–20 min |
| Compressor de amônia | temperatura do túnel sobe | tempo de congelamento ↑ → túnel perde capacidade → antecâmara lota → **linha reduz** | 1–3 h |
| Câmara fria cheia (navio / contêiner) | ocupação > 93% | armazenagem limitada → túneis travam → **linha reduz** | dias (acumula) |
| Balança de produto acabado sem integração | tickets não chegam ao ERP | NF-e não é solicitada → pátio e docas lotam | 15–30 min |
| SEFAZ indisponível | cStat 108/109, timeouts | caminhões retidos até a contingência (SVC) | minutos a horas |
| Certificado digital vencido | cStat 281 em todas as notas | expedição **inteira** parada até a troca do certificado | imediato |

### A6. Como o Dynatrace observaria cada etapa

| Etapa | Fonte de dados no Dynatrace | Tipo |
| --- | --- | --- |
| Caminhões, pesagens, cargas, NF-e | **Business Events** (`bizevents`) enviados pelo ERP, sistema de integração, WMS e mensageria, via API de ingestão e **OpenPipeline** | eventos de negócio |
| Processo ponta a ponta (caminhão → NF-e → portaria) | **Business Flow**: passos definidos por bizevents e ligados por um ID de correlação (ID da carga), com KPIs de fluxos concluídos, exceções e tempo médio | processo |
| CLPs, sensores, compressores, túneis, câmara, balanças | **OpenTelemetry** (Collector com receptores industriais) ou **Extensions**; métricas de temperatura, pressão, velocidade de linha, estado do indicador de pesagem | métricas OT |
| ERP, mensageria NF-e, gateways de integração | **OneAgent** (traces, logs, métricas de serviço) | APM |
| SEFAZ (serviço externo) | **Synthetic** (monitor HTTP do serviço de status) + taxa de erro/latência das chamadas de saída | disponibilidade |
| Certificado digital | Evento de validade do certificado (log/bizevent da mensageria) com previsão | previsão |
| Correlação, causa raiz, previsão | **Dynatrace Intelligence** (IA causal e preditiva) sobre topologia e eventos | problemas |
| Automação (ex.: acionar contingência SVC) | **Workflows** | automação |

Fontes: [Business Flow](https://docs.dynatrace.com/docs/observe/business-observability/business-flow)
("monitorar e analisar fluxos de processos críticos, atrasos ponta a ponta, anomalias e KPIs");
[API de ingestão de Business Events](https://docs.dynatrace.com/docs/observe/business-observability/bo-api-ingest)
(`POST /api/v2/bizevents/ingest`, CloudEvents, até 5 MB por requisição; consulta com
`fetch bizevents | filter event.type == "…"`); [OpenPipeline](https://docs.dynatrace.com/docs/platform/openpipeline/concepts/extraction/data-extraction);
[OpenTelemetry e Dynatrace](https://docs.dynatrace.com/docs/shortlink/opentelemetry).

### A7. O plano do PCP: calendário diário, hora extra e dia extra

*Pedido do dono (2026-10-01): "a produção na indústria obedece um planejamento de produção feito
pelo PCP, e esse plano tem um calendário diário do volume de kg de produto produzido e quantidade
de aves abatidas. Os impactos na linha comprometem inclusive o plano. Isso pode gerar hora ou dia
extra de abate caso precisem recuperar a meta de produção do mês."*

- **O que o PCP planeja.** O PCP (Planejamento e Controle da Produção) transforma a demanda
  (pedidos de exportação e do mercado interno) e a oferta de aves (lotes alojados pelo fomento nos
  integrados ~42–45 dias antes) num **calendário diário**: quantas aves abater e quantos quilos de
  cada família de produto embalar em cada dia útil. A soma dos dias é a **meta do mês**. Na
  integração, a programação de abate precisa ser constante para que a aquisição diária de aves não
  gere perda para o frigorífico (Embrapa, cálculo de aviários pela necessidade diária de abate,
  com ~20 dias de abate por mês).
- **Por que um incidente compromete o plano.** O ritmo da linha é a capacidade. Uma hora de linha
  reduzida pela metade são ~7 mil aves a menos — e os lotes do dia **já estão em apanha e
  transporte**: as aves que chegam precisam ser abatidas no mesmo dia (bem-estar, DOA, perda de
  peso). As que ficam nos integrados continuam ganhando peso e consumindo ração e empurram o
  alojamento do próximo lote.
- **Como se recupera.** (1) **Hora extra** no mesmo dia ou nos dias seguintes: a CLT
  (art. 59) permite acrescer **até 2 horas** à jornada diária, com remuneração **pelo menos 50%**
  superior à da hora normal. (2) **Dia extra** de abate: com jornada de 8h48 de segunda a sexta
  (44 h semanais, sábado compensado), o sábado é o dia natural de recuperação — um turno abate
  ~127 mil aves; domingos e feriados trabalhados sem folga compensatória são pagos em dobro
  (Súmula 146 do TST), por isso ficam como último recurso. A escala ainda precisa respeitar as
  pausas da NR-36 (frigoríficos), o que limita na prática quantas horas extras seguidas fazem
  sentido.
- **O que importa observar.** Aderência ao plano **até agora** (não só no fim do dia), projeção do
  fechamento do dia e do mês no ritmo planejado, custo de cada incidente em **horas de abate** e
  a decisão (hora extra × sábado) a tempo de o fomento reprogramar a apanha e o transporte.
- **Dia de produção.** Para que o turno 2, a hora extra e as caixas embaladas depois da
  meia-noite contem no dia em que o abate começou, o dia de produção vai das **03:00 às 03:00**.

Fontes: [CLT, art. 59 (resumo)](https://jus.com.br/artigos/93201/conceito-legal-sobre-horas-extras);
[Súmula 146 do TST](https://flashapp.com.br/blog/trabalhar-na-folga-sumula-146);
[Embrapa — planejamento de aviários pela necessidade diária de abate](https://www.infoteca.cnptia.embrapa.br/infoteca/handle/doc/439743).

---

## Parte B — Planejamento (spec)

### Goal

Permitir que um apresentador mostre, **em movimento**, a cadeia de um frigorífico de aves — da
balança de frango vivo à NF-e autorizada e ao destino (mercado interno ou país de exportação) —
com os números de cada etapa, e demonstre como o Dynatrace detecta, explica e quantifica um
gargalo **e a sua propagação** ao longo da cadeia, sem nenhum dado no ambiente.

### Non-goals

- Ler dados reais do tenant (roadmap: fonte Grail, ver *Dados & integrações*).
- Escrever qualquer coisa no tenant (sem ingestão, sem App State, sem documentos).
- Representar empresa, cliente, transportadora ou integrado **reais**. A empresa é fictícia
  (**Poultry Industry**, Unidade PR-01); clientes são códigos (`Rede varejista SP-014`,
  `Importador EAU-03`); CNPJs e chaves de acesso são mascarados e fictícios. Países, estados,
  portos e órgãos públicos (SEFAZ, SIF, MAPA) são citados porque fazem parte do domínio.
- Emitir, validar ou assinar NF-e de verdade.

### Decisões de produto

| Decisão | Escolha | Por quê |
| --- | --- | --- |
| Idioma | **Português (pt-BR)** em toda a UI, números e datas | O domínio é brasileiro (NF-e, SEFAZ, SIF, DU-E); versão em inglês fica no roadmap |
| Dados | Simulador determinístico no navegador (como o Multi-lane Free Flow) | Instala em qualquer tenant, custo zero de Grail |
| Tempo | Relógio da planta no fuso do visitante; velocidades **1× · 10× · 60×** (padrão **60×**: 1 min = 1 h) | Caminhões e cargas acontecem na escala de horas |
| Incidentes | Rodam no **tempo da planta** (sem replay com números roteirizados): os impactos saem do próprio modelo | A propagação do gargalo é *emergente*, não desenhada |
| Marca | Fictícia, igual ao nome do app | Mesmo padrão do Multi-lane Free Flow |
| Plano do PCP | Calendário do mês com plano diário (aves e kg), aderência até agora, projeção do dia e do mês e recomendação de hora extra / sábado extra, com aprovação em um clique | Pedido do dono (2026-10-01): os incidentes da linha comprometem o plano |
| Strato | Strato onde houver componente; planta, calendário, pipeline da NF-e e partículas são SVG/CSS próprios | O dono pediu flexibilidade, como no Multi-lane Free Flow (2026-10-01) |

### A planta simulada (calibração)

| Parâmetro | Valor |
| --- | --- |
| Linhas de abate | 2 × 7.500 aves/h (nominal 15.000 aves/h; ~97% de disponibilidade) |
| Janelas de abate | Turno 1 05:00–13:48 · Turno 2 14:30–23:18 · higienização 23:18–05:00 |
| Aves por dia | ~256 mil (~729 t de peso vivo) |
| Dia de produção | 03:00 → 03:00 (o turno 2, a hora extra e as caixas embaladas depois da meia-noite ficam no dia do abate) |
| Plano do PCP | dias úteis (seg–sex, sem feriados nacionais): ~255 mil aves (±0,8% por lote) e ~575 t · ritmo de planejamento 14.500 aves/h · meta do mês = soma dos dias úteis |
| Recuperação | hora extra em passos de 15 min, até 2 h/dia (CLT art. 59) · sábado extra = 1 turno de 8h48 ≈ 127.600 aves · histórico sintético do mês (perdas, hora extra e sábados) antes do dia da sessão |
| Peso vivo médio | 2,85 kg |
| Caminhão de aves vivas | 4.200 aves (~12 t líquidas), tara ~16,5 t · ~61 por dia · recebimento 03:30–22:30 |
| Galpão de espera | 14 baias · estoque-alvo 5 caminhões · espera-alvo < 2 h |
| DOA / condenação total / parcial | 0,18% / 0,30% / 8% das carcaças |
| Rendimento de carcaça | 73,9% (patas 3,9%, miúdos 3,7%) |
| Abate → caixa | 90 min (resfriamento, cortes, embalagem) |
| Produto acabado | ~575 t por dia de produção · caixas de 18 kg (~32 mil caixas/dia, ~1.850/h no pico) |
| Antecâmara | 1.200 caixas (excedente vai para a câmara de resfriados e volta quando há espaço) |
| Túneis de congelamento | 3 contínuos × 13.000 caixas · −35 °C · 18 h de permanência (≈ 2.170 caixas/h) |
| Câmara fria | 12.000 posições-palete (56 caixas ≈ 1 t) · −22 °C · ocupação ~80% · máximo prático 98,5% (sem posição livre acima disso) |
| Expedição | ~34 cargas/dia: 42% das cargas em exportação (contêiner reefer 40' ~26 t; ≈ 60% do peso) e 58% no mercado interno (carreta 24 t, truck 12 t, toco 6 t) · picos 05–09 h e 14–19 h · a exportação é a alavanca que equilibra o estoque |
| Agendamento | O veículo chega 15–70 min antes da janela de doca e espera no pátio · carregamento 40–110 min conforme o veículo |
| Docas / pátio | 6 docas · 10 vagas no pátio (espera de doca e espera de NF-e dividem as vagas) |
| NF-e | ~60 por dia (1 por contêiner, 1–5 por caminhão do mercado interno) · SEFAZ-PR p95 ~1,9 s · contingência SVC-RS (`tpEmis 7`) ativada pela SEFAZ-PR ~1h15 após a queda |
| Regra de operação da linha | Antecipação de 90 min: a velocidade da linha é limitada ao que túneis e câmara conseguem absorver, descontando o que já está em processo |
| Mix de produto (peso) | inteiro 22% · peito 20% · coxa 8% · sobrecoxa 10% · asa 8% · coração 0,6% · miúdos 4% · patas 4,6% · salsicha 9% · frango a passarinho 7% · empanados 6,8% |
| Exportação por país (fictício, inspirado no ranking ABPA) | EAU 17 · Japão 13 · Arábia Saudita 12 · China 11 · África do Sul 8 · México 8 · Filipinas 6 · Chile 5 · Coreia do Sul 4 · Singapura 4 · Reino Unido 4 · Países Baixos 3 · Catar 3 · Kuwait 2 (%) |
| Mercado interno por UF | SP 31 · PR 18 · RJ 11 · MG 9 · SC 7 · RS 6 · BA 5 · PE 4 · GO 4 · DF 3 · outros 2 (%) |
| Preços | ilustrativos, por produto e mercado (câmbio simulado R$ 5,40/US$) |

**Contrato de calibração** (`npm run test:sim`, dia útil às 10:00 local):
ritmo de abate 13.500–15.000 aves/h · rendimento 73,5–74,3% · DOA 0,10–0,30% · câmara 75–86% ·
NF-e p95 1,2–2,6 s · saúde 90–97 · dia completo: 240–270 mil aves, 520–620 t embaladas, 20–34 cargas,
40–110 NF-e; cenários: cada um precisa produzir o efeito que o card da Dynatrace Intelligence descreve
(ex.: túnel → antecâmara ≥ 40% e linha abaixo de 90% do plano em até 3 h de planta; SEFAZ → ao menos
uma carga aguardando NF-e antes da SVC-RS e fila drenada depois dela). **PCP:** plano do dia
250–260 mil aves; aderência às 11:00 entre 97% e 103% e status OK; fim de um dia normal 98–104%;
túnel por 3 h → dia abaixo do plano e recomendação de 15 min a 2 h de hora extra hoje, com card da
Intelligence e aprovação em um clique; 1 h aprovada soma 14.500 aves à projeção e mantém a linha
rodando às 23:45; virada de mês fecha setembro com o último dia simulado; um dia perdido leva à
recomendação de sábado extra (≈ 127,6 mil aves).

### Cenários (teclas 1–7) — um por elo da cadeia

| # | Cenário | Causa raiz (roteirizada) | Efeito emergente no modelo | Detecção |
| --- | --- | --- | --- | --- |
| 1 | **Calor no galpão de espera** | Inversor do banco de ventiladores V-04 desarmou em dia de 34 °C | temperatura do galpão sobe; DOA cresce com o tempo de espera; perda de peso | 6 min |
| 2 | **Contaminação na evisceração** | Queda de vácuo na evisceradora da linha 2 | contaminação 1,2% → ~7% na L2; SIF reduz L2 para 5.000 aves/h; condenas ↑; rendimento ↓ | 5 min |
| 3 | **Compressor de amônia — Túnel 2** | Ventilador do condensador evaporativo parado → pressão de descarga alta → compressor C-3 desarmou | T2 aquece acima de −28 °C e deixa de receber; T1 e T3 operam a ~−31 °C; capacidade de congelamento cai ~45%; antecâmara enche; **linha reduz** | 4 min |
| 4 | **Navio omitiu escala (câmara fria lotada)** | Booking rolado em Paranaguá: 4 dias sem retirada de contêineres | inicia no "dia 4": câmara a 98,5%, contêineres ainda não fechados são cancelados; a armazenagem só acompanha as retiradas do mercado interno; túneis travam; **linha reduz** | 8 min |
| 5 | **Balança de produto acabado sem integração** | Gateway serial-TCP GW-BAL-02 reiniciando após atualização de firmware | tickets não chegam ao ERP; NF-e não é solicitada; pátio e docas lotam; digitação manual (25 min por ticket) após 30 min | 3 min |
| 6 | **SEFAZ-PR indisponível** | Autorizadora estadual fora do ar (cStat 108 → 109) | cargas retidas; a SEFAZ-PR ativa a SVC-RS após ~1h15 e um Workflow troca a mensageria para **tpEmis 7**; fila drena | 2 min |
| 7 | **Certificado digital A1 vencido** | e-CNPJ da mensageria expirou (a previsão já aparecia na abertura do app) | cStat 281 em todas as notas; expedição parada até instalar o certificado renovado | 1 min |

Tecla **0** encerra os incidentes ativos. A abertura do app já mostra uma **previsão** da
Dynatrace Intelligence: *certificado A1 da mensageria vence em 12 dias*.

### Scopes

| Scope | Justificativa |
| --- | --- |
| — | Nenhum. O app não lê nem escreve nada no ambiente. |

Adicionar o primeiro scope é um bump **MAJOR** (todo usuário precisa consentir de novo).

### Data

**Grail:** nenhuma tabela nesta versão. **DQL:** nenhuma. O simulador (`ui/app/sim/`) gera tudo.
A aba *Dados & integrações* documenta os Business Events (`poultry.*`), campos, métricas OT e o
fluxo do Business Flow necessários para rodar com dados reais; essas consultas precisarão ser
escritas, executadas contra eventos reais e medidas antes de serem publicadas (R6).

### UI

**Rotas:** `/` (Ao vivo), `/plano` (Plano PCP), `/vendas` (Vendas & expedição), `/como-funciona`, `/dados`.

| Componente | Subpath |
| --- | --- |
| `AppHeader`, `PageLayout` (+ `Details`) | `@dynatrace/strato-components/layouts` |
| `Chip`, `HealthIndicator`, `AiResponse`, `AiLoadingIndicator`, `Accordion`, `KeyboardShortcut` | `@dynatrace/strato-components/content` |
| `Switch`, `ToggleButtonGroup`, `TextInput` | `@dynatrace/strato-components/forms` |
| `Sheet`, `Modal`, `Tooltip` | `@dynatrace/strato-components/overlays` |
| `ToastContainer`, `showToast` | `@dynatrace/strato-components/notifications` |
| `DataTable`, `SimpleTable` | `@dynatrace/strato-components/tables` |
| `TimeseriesChart`, `CategoricalBarChart`, `DonutChart`, `TopList`, `GaugeChart` | `@dynatrace/strato-components/charts` |
| `Button` | `@dynatrace/strato-components/buttons` |
| `Heading`, `Paragraph`, `Text`, `List`, `Strong`, `ExternalLink` | `@dynatrace/strato-components/typography` |
| `useCurrentTheme` | `@dynatrace/strato-components/core` |
| `AiIcon` e ícones de ação | `@dynatrace/strato-icons` |

Esboço da tela **Ao vivo**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ AppHeader: Ao vivo | Vendas & expedição | Como funciona | Dados   [Simulação][1× 10× 60×] … │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────────────────────────────┤
│Marca │Saúde │Aves  │Ritmo │Rend. │Cond. │Câmara│P.A.  │Exped.│ NF-e                         │
├──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴───────────┬──────────────────┤
│ Planta (SVG animado): caminhões de aves vivas → balança FV → galpão →    │ Gargalos da      │
│ linhas 1 e 2 → cortes → embalagem → antecâmara → túneis → câmara fria →  │ cadeia (12 elos, │
│ docas → balança PA → pátio/NF-e → portaria → mercado interno / porto     │ restrição atual, │
│                                                                           │ contrapressão)   │
├──────────────────┬───────────────────┬────────────────────────┬──────────┴──────────────────┤
│ Balança FV &     │ Rendimento &      │ Faturamento NF-e ·     │ Expedição hoje              │
│ galpão de espera │ condenas          │ SEFAZ (pipeline + NF-e)│ (docas, cut-off, destinos)  │
└──────────────────┴───────────────────┴────────────────────────┴─────────────────────────────┘
      Dynatrace Intelligence: aba recolhível na borda direita (tecla I)
```

Tela **Plano PCP**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Plano do PCP · <mês>                                                     [Aves | Produto] │
├─────────┬──────────┬──────────────┬─────────────┬───────────────┬────────────────────────┤
│Hoje aves│Hoje kg   │Fechamento dia│Mês até agora│Projeção do mês│Recuperação (HE, extras)│
├─────────┴──────────┴──────────────┴─────────────┼───────────────┴────────────────────────┤
│ Calendário do mês (D S T Q Q S S): plano, real,  │ Recomendação do PCP: hora extra hoje /  │
│ barra de aderência, HE, dia extra, perdas        │ nos próximos dias / sábado extra        │
│                                                  │ [Aplicar] [−15 min] HE [+15 min] [sáb.] │
│                                                  │ Mês anterior                            │
├──────────────────────────────┬───────────────────┴────────────────────────────────────────┤
│ Hoje: plano × real por hora  │ Mês: meta × realizado acumulados                           │
├──────────────────────────────┴────────────────────────────────────────────────────────────┤
│ Dias do mês (DataTable)                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Na tela **Ao vivo**, o KPI *Aves abatidas hoje* mostra a aderência ao plano até agora (e muda de
cor), o elo *Abate* avisa quando está abaixo do plano, cada incidente que tira aves da linha
mostra o custo em horas de abate, e a Dynatrace Intelligence abre uma **previsão** "Plano do PCP
em risco" com o botão de aprovar a hora extra (tecla **H**).

Tela **Vendas & expedição**: indicadores do dia (t, US$, R$, cargas, NF-e), exportação por país,
mercado interno por UF, mix de produtos, produção × expedição por hora, ocupação da câmara e a
tabela de cargas do dia (com NF-e e status).

### Visualization

| Painel | Componente | Por que este para estes dados |
| --- | --- | --- |
| Planta | SVG customizado (animação imperativa) | Espacial, por veículo e por esteira; nenhum gráfico modela uma planta |
| KPIs | Tiles + odômetro + sparkline (SVG) | Números de manchete com tendência e limiares |
| Gargalos da cadeia | Barras de utilização por elo + marcador da restrição | Pergunta "onde está o gargalo agora?" — ordem da cadeia importa |
| Balança FV | Lista animada de pesagens + baias do galpão | Eventos discretos recentes + ocupação espacial |
| Rendimento | Cascata (SVG) + `TopList` de causas de condenação | Balanço de massa sequencial + ranking |
| NF-e | Pipeline com partículas (SVG) + lista de notas | Fluxo por etapas com fila, contingência e rejeições |
| Expedição (Ao vivo) | Docas (estado) + `DonutChart` exportação × mercado interno | Estado atual + composição |
| Exportação por país / por UF | `CategoricalBarChart` horizontal | Comparação entre categorias |
| Mix de produtos | `DonutChart` | Parte do todo |
| Produção × expedição | `TimeseriesChart` | Tendência temporal de duas séries com a mesma unidade |
| Ocupação da câmara | `GaugeChart` | Um valor contra um limite |
| Cargas do dia | `DataTable` | Registro detalhado, ordenável |
| Calendário do PCP | Grade CSS própria (7 colunas) | Um mês é espacial (semanas × dias); nenhum componente Strato cobre calendário com valores por dia |
| Plano × realizado por hora | `CategoricalBarChart` agrupado | Comparação lado a lado por hora |
| Meta × realizado acumulados | `TimeseriesChart` | Duas curvas acumuladas na mesma unidade ao longo do mês |
| Dias do mês | `DataTable` | Registro ordenável (plano, real, aderência, HE, observação) |
| Jornada da carga / do caminhão | Barras em cascata (SVG) | Tempo sequencial, estilo trace |

**Teste de monotonia (R8):** 8 tipos distintos de visualização na tela Ao vivo; camada de manchete
presente. ✅

### Data contract

| Componente | Forma esperada | Verificado em |
| --- | --- | --- |
| `TimeseriesChart` | `data: Timeseries[]`, `Timeseries = { name, datapoints: { start: Date, end?: Date, value }[], unit? }` | `charts/core/types/timeseries.d.ts` |
| `CategoricalBarChart` | `data: { category: string; value: number \| Record<string, number> }[]`, `layout` | `charts/categorical-bar/types/categorical-bar-chart.d.ts` |
| `DonutChart` | `data: ChartData`, `labelAccessor`, `valueAccessor` (ou `{ slices }` legado) | `charts/pie/types/pie-chart.config.d.ts` |
| `TopList` | `data: Record<string, unknown>[]`, `labelAccessor`, `valueAccessor` | `charts/top-list/types/top-list.d.ts` |
| `GaugeChart` | `value: number`, `min`, `max`, `unit` | `charts/gauge/types/gauge-chart.d.ts` |
| `HealthIndicator` | `status: 'ideal' \| 'good' \| 'neutral' \| 'warning' \| 'critical'` | `content/health-indicator` |
| `DataTable` | `data: Row[]`, `columns: { id, header, accessor }[]` | `tables/DataTable` |

Contrato do simulador: `ui/app/sim/types.ts` → `Snapshot`, verificado por `npm run test:sim`.

### States

| Visão | Carregando | Vazio | Erro |
| --- | --- | --- | --- |
| Balança FV | — | "Aguardando o primeiro caminhão do dia…" | — |
| NF-e | — | "Nenhuma nota emitida ainda hoje." | — |
| Detalhes | — | "Este item não está mais no histórico recente." | — |
| Gráficos de vendas | — | "Sem expedição registrada ainda hoje." | — |

Sem chamadas de rede: não há estados de carregamento nem de erro.

### Cost (DPS)

| | |
| --- | --- |
| Queries por abertura do app | 0 |
| Auto-refresh | não se aplica |
| Bytes varridos por execução | 0 |
| GB estimados por mês | 0 |

### Security

- Novos segredos? Nenhum. `.env` guarda só credenciais locais dos servidores MCP e é ignorado.
- Chamadas externas? Nenhuma (nem mesmo à SEFAZ: tudo é simulado).
- Dados persistidos? Só preferências no `localStorage` do navegador.
- Entrada do usuário chegando a DQL? Nenhuma.
- CNPJs e chaves de acesso mascarados; clientes e veículos identificados por códigos fictícios.

### Evidence

| Afirmação | Fonte | Verificado |
| --- | --- | --- |
| Build, lint, tipos e calibração | `npx dt-app build`, `npm run lint`, `npm run typecheck`, `npm run test:sim` | ✅ |
| Renderização da UI (temas claro e escuro, cenários) | bundle servido localmente e aberto em Chromium headless (screenshots em `docs/img/`) | ✅ |
| Componentes Strato e subpaths | `node_modules/@dynatrace/strato-components` 3.14.2 (`.d.ts`) | ✅ |
| `_SankeyChart` é `@internal` (não usado; balanço de massa em SVG próprio) | `charts/sankey-chart/types/sankey-props.d.ts` | ✅ |
| Padrões do app (AppHeader, Intelligence, fontes, apresentador) | código do Multi-lane Free Flow 0.1.0 (mesmo autor) | ✅ |
| Business Flow, bizevents, OpenPipeline, OTel | docs.dynatrace.com (via resultados de busca; acesso direto bloqueado nesta sessão) | ⚠️ resumo |
| Números do setor, NF-e, SEFAZ, DU-E, GTA | fontes da Parte A (via resultados de busca) | ⚠️ resumo |
| `app.description` ≤ 80 caracteres | AGENTS.md do Multi-lane Free Flow (validação do `dt-app build`) | ✅ |
| `DataTable`, `TimeseriesChart`, `CategoricalBarChart`, `DonutChart`, `GaugeChart`, `TopList` e slots | `.d.ts` em `tables/` e `charts/` (Strato 3.14.2) | ✅ |
| `CategoricalBarChart` com `groupMode="grouped"` e `value: Record<string, number>`; `Button` (`variant`, `color`, `size`) | dt-app-mcp (`get_strato_component`, `get_strato_usecases` "GroupMode") | ✅ |
| Hora extra até 2 h/dia com adicional ≥ 50% (CLT art. 59); domingo/feriado não compensado em dobro (Súmula 146 do TST) | resultados de busca (Parte A7) | ⚠️ resumo |
| Plano diário do PCP e meta do mês no simulador | `npm run test:sim` (bloco PCP) e screenshot `docs/img/plan.png` | ✅ |

### Docs impact (R12)

| Alvo | Mudança |
| --- | --- |
| `README.md` | README completo no padrão da casa para 0.1.0 |
| `docs/index.html` | Página do projeto espelhando o README |
| `CHANGELOG.md` | Entrada `[0.1.0]` (inclui o plano do PCP, ainda não publicado) |
| `AGENTS.md` | Dia de produção 03:00–03:00, contrato de calibração do PCP e o desvio R3 aceito (flexibilidade com o Strato) |

### Open questions

1. Uma edição em inglês (como a do Multi-lane Free Flow) é desejada?
2. Quando construir a fonte de dados real (Business Events `poultry.*`) e contra quais sistemas
   (ERP, WMS, mensageria NF-e, CLPs)?
3. Os números de referência devem ser ajustados ao porte de uma planta específica?
