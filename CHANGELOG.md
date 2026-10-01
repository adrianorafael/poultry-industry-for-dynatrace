# Changelog

Todas as mudanças relevantes do **Poultry Industry for Dynatrace** ficam registradas aqui.

Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versionamento: [Semantic Versioning](https://semver.org/), em que "quebra" significa quebrar para
quem executa o app — ver `references/release-and-docs-sync.md` em
[Development Pattern for Dynatrace](https://github.com/adrianorafael/development-pattern-for-Dynatrace).

A versão aqui precisa ser igual a `app.config.json` → `app.version`, que é a fonte única da verdade.

## [Unreleased]

## [0.1.0] - 2026-09-30

### Added
- Primeira versão do app de demonstração, para um frigorífico de aves fictício (*Poultry Industry*,
  Unidade PR-01), a partir do documento de pesquisa e planejamento `specs/poultry-industry.md`.
- **Ao vivo:** planta animada da balança de frango vivo à portaria — caminhões de aves vivas (bruto,
  galpão de espera, pendura, tara), duas linhas de abate, graxaria, cortes e embalagem, antecâmara, três
  túneis de congelamento, casa de máquinas de amônia, câmara fria com paletes por família de produto,
  seis docas, pátio, balança de produto acabado, portaria com NF-e e saídas para o mercado interno e o
  porto de Paranaguá.
- **Plano PCP:** calendário diário do mês com o plano de aves e de kg por dia útil (feriados nacionais
  incluídos), realizado e aderência, projeção do fechamento do dia e do mês, custo de cada incidente em
  horas de abate e recomendação do PCP — hora extra hoje ou nos próximos dias ou dia extra de abate —
  com aprovação em um clique, também pela Dynatrace Intelligence e pela tecla H. Limite de hora extra e
  turnos do dia extra configuráveis (regras trabalhistas ficam com o RH).
  Dia de produção de 03:00 às 03:00; dias anteriores à sessão vêm de um histórico sintético e determinístico.
- Faixa de KPIs: saúde da cadeia, aves abatidas (com a aderência ao plano do PCP), ritmo do abate, rendimento de carcaça, DOA + condenação
  total (métrica de perda, nunca verde), câmara fria, produto acabado, expedido e autorização da NF-e.
- **Gargalos da cadeia:** os 12 elos em ordem, com utilização, estado, a restrição atual e a
  contrapressão (▲) nos elos que já a sentem.
- Painéis de balança de frango vivo e galpão, rendimento e condenas (balanço de massa e causas),
  faturamento NF-e (fluxo ERP → mensageria → SEFAZ-PR / SVC-RS com partículas, cStat e tpEmis) e expedição.
- **Vendas e expedição:** exportação por país, mercado interno por UF, mix de produtos, produção ×
  expedição por hora, ocupação da câmara e a tabela de cargas do dia; visão "Mês até agora" estimada.
- Jornada do caminhão e da carga (cascata estilo trace) com NF-e, chave de acesso mascarada e protocolo.
- **Dynatrace Intelligence** recolhível, com previsão de vencimento do certificado A1 e sete cenários com
  causa raiz, impacto calculado pelo próprio modelo, ação recomendada e explicação.
- Sete cenários do apresentador, um por elo: calor no galpão de espera, contaminação na evisceração,
  compressor de amônia do túnel, navio que omitiu escala (câmara lotada), balança de produto acabado sem
  integração, SEFAZ-PR indisponível (contingência SVC-RS) e certificado digital vencido.
- Painel do apresentador, atalhos, tour automático de 6 minutos, modo TV, "Fontes Dynatrace" e resumo.
- Abas **Como funciona** e **Dados e integrações** (eventos, campos, métricas OT, Business Flow,
  Workflows e ordem de implantação para rodar com dados reais).
- Testes de calibração do simulador (`npm run test:sim`), README, página do projeto e AGENTS.md.

### Cost
- Nenhuma consulta DQL, nenhuma app function e nenhum escopo OAuth: esta versão **não gera consumo de
  Grail Query**.
