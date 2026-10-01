# AI Coding Agent Instructions — Poultry Industry for Dynatrace

> **Keep `CLAUDE.md` next to this file.** It holds the Dynatrace App Toolkit's own guidance
> (Strato, SDKs, DQL, `dt-app-mcp`). This file is **additive**: it records what Dynatrace
> cannot know — this app's identity, scopes, traps and version discipline. Do not copy content
> between the two; a copy is a second source of truth that drifts.

## Follow the development pattern

This project is built under **[Development Pattern for Dynatrace](https://github.com/adrianorafael/development-pattern-for-Dynatrace)**.
Load that skill before writing, reviewing, running, deploying or publishing any code here.

Its twelve non-negotiable rules apply to every change in this repository, including
"tiny" ones:

1. Never publish a secret — no tokens, `.env`, tenant IDs or tenant URLs.
2. Never invent an API — verify against `node_modules/**/*.d.ts`, `dt-app-mcp`, or
   developer.dynatrace.com.
3. Strato only — no MUI, Tailwind, Recharts, Chart.js or D3.
4. Research the docs, depth-first, before writing a spec.
5. Spec before code, with an approval gate.
6. Every DQL is executed against a live tenant before it ships.
7. Every visualization is fed a verified data shape.
8. No monotonous screens — chart type follows the data's shape and question.
9. Review AI-written code like hostile code.
10. No AI co-authorship in commits, PRs, README or page.
11. Naming convention: `<App Name> for Dynatrace`.
12. Every publication bumps `app.version` (SemVer); every push that changes behaviour,
    setup or cost updates the README **and** the project page in the same commit.

## Project specifics

- **App id:** `my.poultry.industry` (keep the `my.` prefix — unsigned app)
- **App name (in-product):** `Poultry Industry` — public name: *Poultry Industry for Dynatrace*
- **Language:** the UI, the README and the project page are in **Portuguese (pt-BR)**; numbers and
  dates use the pt-BR format (`format.ts`). The domain is Brazilian (NF-e, SEFAZ, SIF, DU-E, GTA).
- **Brand:** "Poultry Industry" is a **fictitious** poultry company (Unidade PR-01). Never add a real
  integrator, producer, customer, carrier or shipping line name. Customers are codes
  (`Rede varejista SP-014`, `Importador AE-03`), vehicles are codes (`FV-231`, `CG-014`) and the issuer
  CNPJ inside NF-e access keys is always masked. Public institutions and places (SEFAZ-PR, SVC-RS, SIF,
  MAPA, ADAPAR, Porto de Paranaguá, countries, states) are real because they are part of the domain.
- **Grail tables used:** none. The app runs a deterministic simulator in the browser
  (`ui/app/sim/`). No DQL ships in this version — the *Dados e integrações* tab documents events and
  metrics, but contains no query (R6).
- **Scopes:** none (`app.config.json` → `scopes: []`). Adding the first scope is a **MAJOR** bump.
- **Persistence:** browser `localStorage` only (key `poultry-industry.prefs`); no App State.
- **Research and plan:** `specs/poultry-industry.md` is the research + planning document the app was
  built from (sources, reference numbers, scenarios, calibration). Keep it in sync with the model.
- **Version:** `app.config.json` → `app.version` is the single source of truth; every
  release is recorded in `CHANGELOG.md`, and README + `docs/index.html` state the same version.

## Architecture in one paragraph

`sim/engine.ts` is a pure TypeScript engine (no React) that steps the plant in 1-second plant
steps (15-second steps to warm up the last 30 h on open, on a jump in time and after a hidden
tab): live-bird trucks through the two-platform scale, the holding shed and the hanging platform;
two slaughter lines with micro-stops, SIF speed reduction and condemnations by cause; a 90-minute
process pipeline to packed boxes; the antecâmara (with chilled holding on overflow); three
continuous freezing tunnels whose dwell time depends on temperature; the cold store with free
pallet positions; expedition loads with appointments, docks, the finished-goods scale, the yard,
ERP invoicing and NF-e authorization (SEFAZ-PR, SVC-RS contingency, cStat) and the gate. The line
speed follows an operating rule with a 90-minute feed-forward on what the freezing side can absorb,
so bottlenecks propagate backwards on their own. React reads a snapshot 4× per second
(`useSyncExternalStore`); the plant scene (trucks, conveyors, bird lines) and the NF-e particles are
drawn **imperatively** from one shared `requestAnimationFrame` (`state/engine-context.tsx`).

The **PCP plan** lives in the same engine: a calendar of the current month (`monthCalendar`) with a
plan per working day (birds and kg; national holidays and Good Friday excluded), a deterministic
synthetic history for the days before the session (`pcpAnchor`), and the simulated actuals from the
session day on. Slaughter windows come from the day's calendar entry (`windows()`), so approved
overtime (`approveOvertime`) extends shift 2 past midnight and a scheduled extra day (`toggleExtraDay`,
Saturday, Sunday or holiday) runs one or two shifts. Labor rules are **out of scope** (owner,
2026-10-01: a demo, and working-hour rules belong to HR systems — "aqui aceita o que for
configurado"): the overtime limit per day and the extra-day shifts are PCP settings (`setPcpConfig`,
stored with the presenter prefs); the only hard bound is the end of the production day at 03:00. `pcpView()` computes adherence to the plan to now, the end-of-day and end-of-month
projections at the planning rate (14,500 birds/h) and the recommendation (`recovery()`: close the day
with overtime; otherwise the month with overtime on the next working days or an extra slaughter day).

## Traps already hit in this repository

- `@dynatrace/strato-components-preview` is deprecated — import from
  `@dynatrace/strato-components/<subpath>`.
- `SankeyChart` exists in Strato 3.14 only as the **internal** `_SankeyChart` — the mass balance is a
  custom SVG instead.
- `KeyboardShortcut` treats `+` as a key separator: the "faster" shortcut is shown as `=`.
- `SimpleTable` takes **two** generic arguments: `SimpleTable<Row, string>`.
- `ToastContainer` must be rendered explicitly (`App.tsx`); `AppRoot` does not include it.
- `app.description` in `app.config.json` is limited to **80 characters** — the build fails otherwise.
- `PageLayout.Details` works when wrapped in a component (slots are portal-based).
- Served outside Dynatrace (e.g. screenshots from `dist/`), the SDK logs "Missing getTheme/getLanguage
  function from web runtime" and charts fall back to English date/number formats — expected.
- At 10× and 60× the KPI odometers would roll on every refresh: rolling is disabled above 1×.
- The calibration tests (`npm run test:sim`) pin a **local** weekday at 10 am; the plant clock follows
  the viewer's local time zone.
- The **production day runs 03:00 → 03:00** (`prodParts` in `sim/time.ts`): "today" totals, the PCP
  actuals and the slaughter windows use it, so shift 2 overtime past midnight and the boxes packed
  until ~02:50 stay in the day the slaughter started. Expedition profiles still use the clock hour.
- The simulated plant slaughters **every** day: a Saturday, Sunday or holiday on the clock is shown in the
  PCP calendar as an extra slaughter day (and counts towards the month's actual, not its goal).
- Today's plan status uses an absolute tolerance (15 / 30 min of slaughter) besides 2% / 5%: a random
  micro-stop early in the shift would otherwise flash the birds KPI yellow.

## Accepted deviations from the pattern (same as Multi-lane Free Flow, decided by the owner)

- **R3 §5 — hardcoded colors.** Status green / yellow / red, the fictitious brand palette, product
  families, markets and the illustrated plant use hex values from `theme/colors.ts` instead of Strato
  design tokens. UI chrome uses Strato tokens.
- **R3 §5 — non-Strato interactive elements.** KPI tiles, chain rows, shed bays, dock rows and feed rows
  are native `<button>` elements; trucks and plant areas are clickable SVG groups (SVG has no Strato
  equivalent); the Intelligence drawer backdrop is a `div` whose click closes it (Esc and *Recolher*
  are the accessible alternatives).
- **R11 — repository name.** The repository is `poultry-industry-for-dynatrace` (lowercase), by the
  owner's choice; README H1, page title and app name follow the convention.
- **§6 — empty states** use plain text instead of `EmptyState`.
- **R3 — Strato flexibility (owner, 2026-10-01: "O Strato não tem todos os componentes necessários.
  Seja flexível com essa regra como o MLFF foi").** Strato is used wherever a component exists
  (charts, tables, buttons, forms, overlays, typography); the plant scene, the PCP month calendar, the
  NF-e pipeline and its particles are custom SVG/CSS because Strato has no equivalent.

## Calibration contract

`npm run test:sim` must pass before every push. For a weekday at 10 am it asserts: line
13,500–15,000 birds/h, carcass yield 73.5–74.3%, DOA 0.1–0.3%, cold store 75–86%, NF-e p95
1.2–2.6 s, health 90–97; for a full day: 240–270 thousand birds, 520–620 t packed, 20–34 loads,
40–110 NF-e; and, for each of the seven scenarios, the effect its Dynatrace Intelligence card describes.
For the PCP plan: 250–260 thousand birds planned for the day, adherence 97–103% at 11 am with OK status,
98–104% at the end of a normal day, deterministic history, a tunnel failure that recommends overtime
today (and raises the Intelligence plan-risk card), 1 h approved = +14,500 birds in the projection with
the line still running at 23:45, the month rollover, a lost day that recommends an extra day on a
Saturday (one shift ≈ 127,600 birds, two ≈ 255,200), 3h30 of overtime accepted by default and bounded
only at 03:00, a configured 1 h limit that trims the approved overtime, and boxes packed after 03:00
counted on the slaughter day.

## MCP servers — two of them, different jobs

| Server | Job | Without it |
| --- | --- | --- |
| `dt-app-mcp` | Strato components, SDK docs, DQL knowledge base, experience standards. No credentials. | Component lookups fall back to `node_modules/**/*.d.ts`. |
| `dynatrace-mcp` | Executes DQL against the tenant (`DT_ENVIRONMENT`, `DT_PLATFORM_TOKEN` from `.env`). | **R6 cannot be satisfied** for any future query. |

Both are declared in `.mcp.json` with environment-variable references only.

## Dynatrace knowledge: reference, never vendor

Dynatrace's own agent skills (https://github.com/Dynatrace/dynatrace-for-ai) are the
authority for DQL and Grail semantics. **Fetch the file you need at the moment you need
it.** Never commit one into this repository.

## Commands

```bash
npm install
npx dt-app dev        # local dev — open the printed link, NOT localhost:3000
npm run lint          # ESLint incl. security + no-secrets rules
npm run typecheck     # tsc --noEmit
npm run test:sim      # simulator calibration tests
npm run scan:secrets  # R1 secret scan of the working tree
npx dt-app deploy     # ONLY with explicit approval, and name the target tenant first
```
