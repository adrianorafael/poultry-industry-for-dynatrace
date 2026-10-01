/* Simulator calibration tests. Run with: npm run test:sim */
import { Engine } from "../engine";
import type { ScenarioId } from "../scenarios";

// Wednesday, 2026-09-30, 10:00 local time.
const WED_10AM = new Date(2026, 8, 30, 10, 0, 0).getTime();

let failures = 0;
function check(name: string, value: number, lo: number, hi: number): void {
  const ok = value >= lo && value <= hi;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${value.toFixed(2)} (expected ${lo}–${hi})`);
}

/** Runs `plantMin` plant minutes at 60× in 100 ms frames. */
function run(engine: Engine, plantMin: number, clock: { now: number }): void {
  const frames = Math.ceil((plantMin * 60_000) / 60 / 100);
  for (let i = 0; i < frames; i++) {
    clock.now += 100;
    engine.tick(clock.now);
  }
}

function fresh(at = WED_10AM, seed = 20260930): { e: Engine; clock: { now: number } } {
  const e = new Engine(seed);
  e.setSimTime(at);
  e.setSpeed(60);
  const clock = { now: 1000 };
  e.tick(clock.now);
  return { e, clock };
}

// ---------------------------------------------------------------- determinism
{
  const a = fresh();
  const b = fresh();
  run(a.e, 60, a.clock);
  run(b.e, 60, b.clock);
  const sa = a.e.getSnapshot();
  const sb = b.e.getSnapshot();
  const same = sa.kpi.birdsToday === sb.kpi.birdsToday && sa.weighings.map((w) => w.id).join() === sb.weighings.map((w) => w.id).join();
  if (!same) failures++;
  console.log(`${same ? "ok  " : "FAIL"} determinism: same seed, same plant (${Math.round(sa.kpi.birdsToday)} birds)`);
}

// ---------------------------------------------------------------- weekday at 10 am
{
  const { e, clock } = fresh();
  run(e, 60, clock);
  const s = e.getSnapshot();
  check("line rate (birds/h)", s.kpi.lineRate, 13500, 15000);
  check("carcass yield (%)", s.kpi.yield, 73.5, 74.3);
  check("DOA (%)", s.doaPct, 0.1, 0.3);
  check("DOA + total condemnation (%)", s.kpi.condemnPct, 0.35, 0.7);
  check("cold storage (%)", s.kpi.storagePct, 75, 86);
  check("NF-e p95 (s)", s.kpi.nfeP95, 1.2, 2.6);
  check("health (0–100)", s.kpi.health, 90, 97);
  check("antecâmara (%)", s.anteUtil * 100, 0, 60);
  check("trucks in the holding shed", s.bays.filter((b) => b.truckId).length, 2, 9);
  check("held loads", s.kpi.heldLoads, 0, 0);
}

// ---------------------------------------------------------------- one full day
{
  const { e, clock } = fresh(new Date(2026, 8, 30, 0, 5, 0).getTime());
  run(e, 23.8 * 60, clock);
  const s = e.getSnapshot();
  check("birds per day (thousand)", s.kpi.birdsToday / 1000, 240, 270);
  check("finished product per day (t)", s.kpi.finishedT, 520, 620);
  check("shipped per day (t)", s.kpi.shippedT, 450, 720);
  check("loads per day", s.kpi.loadsToday, 20, 34);
  check("export share of shipped weight (%)", s.kpi.exportPct, 45, 75);
  check("NF-e authorized per day", s.nfeToday.authorized, 40, 110);
  check("cold storage at night (%)", s.kpi.storagePct, 74, 88);
}

// ---------------------------------------------------------------- scenarios
function scenario(id: ScenarioId, plantMin: number): { e: Engine; clock: { now: number } } {
  const f = fresh();
  run(f.e, 20, f.clock);
  f.e.toggleScenario(id);
  run(f.e, plantMin, f.clock);
  return f;
}

{
  const { e } = scenario("heat", 120);
  const s = e.getSnapshot();
  check("heat: shed temperature (°C)", s.shedTemp, 32, 35);
  check("heat: DOA (%)", s.doaPct, 0.5, 2);
  check("heat: problem is open", s.problems.filter((p) => p.scenario === "heat" && p.status === "Active").length, 1, 1);
}
{
  const { e } = scenario("evisc", 40);
  const s = e.getSnapshot();
  check("evisc: line 2 contamination (%)", s.lines[1].contamination, 6, 7.5);
  check("evisc: SIF reduced line 2", s.lines[1].sifReduced ? 1 : 0, 1, 1);
  check("evisc: line rate (birds/h)", s.kpi.lineRate, 10500, 13000);
  check("evisc: yield (%)", s.kpi.yield, 72, 73.6);
}
{
  const { e } = scenario("tunnel", 180);
  const s = e.getSnapshot();
  check("tunnel: T2 temperature (°C)", s.tunnels[1].temp, -23, -19);
  check("tunnel: antecâmara (%)", s.anteUtil * 100, 40, 100);
  check("tunnel: line below plan (%)", s.kpi.linePct, 0, 90);
  check("tunnel: constraint is freezing", s.constraint.id === "tuneis" ? 1 : 0, 1, 1);
}
{
  const { e } = scenario("storage", 180);
  const s = e.getSnapshot();
  check("storage: cold store (%)", s.kpi.storagePct, 97.5, 99);
  check("storage: line below plan (%)", s.kpi.linePct, 0, 90);
  check("storage: constraint is the cold store", s.constraint.id === "camara" ? 1 : 0, 1, 1);
}
{
  const { e } = scenario("fgscale", 75);
  const s = e.getSnapshot();
  check("fgscale: held loads", s.kpi.heldLoads, 1, 12);
  check("fgscale: constraint is the scale", s.constraint.id === "balPA" ? 1 : 0, 1, 1);
}
{
  const { e, clock } = scenario("sefaz", 5);
  let waiting = 0;
  for (let i = 0; i < 10; i++) {
    run(e, 5, clock);
    waiting = Math.max(waiting, e.getSnapshot().nfeToday.pendingLoads);
  }
  const s1 = e.getSnapshot();
  check("sefaz: mode before contingency is down", s1.nfeMode === "down" ? 1 : 0, 1, 1);
  check("sefaz: max loads waiting for NF-e before contingency", waiting, 1, 12);
  run(e, 25, clock);
  const s2 = e.getSnapshot();
  check("sefaz: contingency SVC-RS active", s2.nfeMode === "svc" ? 1 : 0, 1, 1);
  check("sefaz: NF-e issued in contingency", s2.nfeToday.svc, 1, 200);
  const p = s2.problems.find((x) => x.scenario === "sefaz");
  check("sefaz: peak held loads", Number(p?.impacts[0]?.value ?? 0), 1, 12);
  run(e, 60, clock);
  check("sefaz: backlog drained in contingency", e.getSnapshot().nfeToday.pendingLoads, 0, 2);
}
{
  const { e } = scenario("cert", 60);
  const s = e.getSnapshot();
  check("cert: NF-e rejected", s.nfeToday.rejected, 1, 500);
  check("cert: held loads", s.kpi.heldLoads, 1, 14);
  check("cert: health (0–100)", s.kpi.health, 40, 85);
}

// ---------------------------------------------------------------- PCP production plan
{
  const { e, clock } = fresh();
  run(e, 60, clock);
  const p = e.getSnapshot().pcp;
  check("pcp: birds planned today (thousand)", p.today.planBirds / 1000, 250, 260);
  check("pcp: adherence to the plan at 11:00 (%)", p.today.adherence ?? 0, 97, 103);
  check("pcp: birds KPI status is ok", e.getSnapshot().kpiLevel.birds === "ok" ? 1 : 0, 1, 1);
  check("pcp: working days in September 2026", p.month.workdays, 21, 21);
  check("pcp: past days with history", p.days.filter((d) => d.when === "past" && d.actualBirds !== null).length, 29, 29);
  check("pcp: month to date (%)", p.month.adherence, 98, 102);
  const again = fresh();
  run(again.e, 60, again.clock);
  const same = again.e.getSnapshot().pcp.days.map((d) => d.actualBirds).join() === p.days.map((d) => d.actualBirds).join();
  if (!same) failures++;
  console.log(`${same ? "ok  " : "FAIL"} pcp: synthetic history is deterministic`);
}
{
  const { e, clock } = fresh(new Date(2026, 8, 30, 0, 5, 0).getTime());
  run(e, 23.8 * 60, clock);
  check("pcp: adherence at the end of a normal day (%)", e.getSnapshot().pcp.today.adherence ?? 0, 98, 104);
}
{
  const { e, clock } = scenario("tunnel", 180);
  const p = e.getSnapshot().pcp;
  check("pcp/tunnel: birds behind the plan to now", -p.today.deltaBirds, 8000, 40000);
  check("pcp/tunnel: day projected below plan", p.today.planBirds - p.today.projectedBirds, 5000, 40000);
  check("pcp/tunnel: overtime today is recommended", p.recovery.kind === "overtime-today" ? 1 : 0, 1, 1);
  check("pcp/tunnel: recommended overtime (h)", p.recovery.suggestTodayH, 0.25, 3.5);
  check("pcp/tunnel: Intelligence raises the plan risk", e.getSnapshot().problems.some((x) => x.id === "pcp-forecast" && x.cta?.overtimeH) ? 1 : 0, 1, 1);
  const note = e.getSnapshot().problems.find((x) => x.scenario === "tunnel")?.impacts[0]?.note ?? "";
  check("pcp/tunnel: incident shows its cost in plan hours", note.includes("abate no plano") ? 1 : 0, 1, 1);
  e.toggleScenario("tunnel");
  run(e, 60, clock);
  const before = e.getSnapshot().pcp.month.projectedBirds;
  e.approveOvertime(1);
  check("pcp/tunnel: overtime approved (h)", e.getSnapshot().pcp.today.extraH, 1, 1);
  check("pcp/tunnel: 1 h of overtime in the month projection (birds)", e.getSnapshot().pcp.month.projectedBirds - before, 14400, 14600);
  run(e, (23.75 - 14.33) * 60, clock);
  const s = e.getSnapshot();
  check("pcp/tunnel: slaughter running in overtime at 23:45 (birds/h)", s.kpi.lineRate, 10000, 15500);
  check("pcp/tunnel: shift label", s.shift === "Hora extra" ? 1 : 0, 1, 1);
  run(e, 4 * 60, clock);
  const n = e.getSnapshot().pcp;
  check("pcp: month rolled over to October", n.monthLabel === "outubro de 2026" ? 1 : 0, 1, 1);
  check("pcp: September closed with the simulated last day (%)", n.previous.adherence, 98, 102);
  check("pcp: September recovered the tunnel loss", n.previous.actualBirds >= n.previous.planBirds ? 1 : 0, 1, 1);
}
{
  // a day lost (most of it): overtime is not enough, a Saturday shift is the way out
  const { e, clock } = fresh(new Date(2026, 9, 7, 9, 0, 0).getTime());
  run(e, 10, clock);
  const lost = e.getSnapshot().pcp.days.find((d) => d.dom === 6);
  // test hook: wipe the history of the day before (as if the plant had stopped)
  const days = (e as unknown as { pcpDays: { dom: number; actualBirds: number | null }[] }).pcpDays;
  const d6 = days.find((d) => d.dom === 6);
  if (d6) d6.actualBirds = Math.round((lost?.actualBirds ?? 0) * 0.3);
  run(e, 1, clock);
  const p = e.getSnapshot().pcp;
  check("pcp/lost day: recovery hours", p.recovery.hours, 8, 20);
  check("pcp/lost day: an extra slaughter day is recommended", p.recovery.kind === "extra-day" ? 1 : 0, 1, 1);
  check("pcp/lost day: the extra day is a Saturday", new Date(p.recovery.extraDay ?? 0).getDay(), 6, 6);
  const before = p.month.gapBirds;
  e.toggleExtraDay(p.recovery.extraDay ?? 0);
  const after = e.getSnapshot().pcp.month.gapBirds;
  check("pcp/lost day: a one-shift extra day closes (birds)", before - after, 120000, 130000);
  e.toggleExtraDay(p.recovery.extraDay ?? 0);
  e.setPcpConfig({ extraDayShifts: 2 });
  e.toggleExtraDay(e.getSnapshot().pcp.recovery.extraDay ?? 0);
  check("pcp/lost day: a two-shift extra day closes (birds)", before - e.getSnapshot().pcp.month.gapBirds, 250000, 260000);
}
{
  // labor rules are HR's: overtime goes as far as configured, bounded only by the production day (03:00)
  const { e, clock } = fresh(new Date(2026, 8, 23, 20, 0, 0).getTime());
  e.approveOvertime(3.5);
  check("pcp/config: 3h30 of overtime accepted by default", e.getSnapshot().pcp.today.extraH, 3.5, 3.5);
  e.approveOvertime(9);
  check("pcp/config: overtime bounded by the end of the production day (h)", e.getSnapshot().pcp.today.extraH, 3.5, 3.75);
  e.setPcpConfig({ overtimeMaxH: 1 });
  check("pcp/config: a configured limit trims the approved overtime (h)", e.getSnapshot().pcp.today.extraH, 1, 1);
  e.setPcpConfig({ overtimeMaxH: null });
  e.approveOvertime(3.5);
  run(e, 6 * 60, clock);
  const s = e.getSnapshot();
  check("pcp/config: still slaughtering at 02:00 (birds/h)", s.kpi.lineRate, 10000, 15500);
  check("pcp/config: 02:00 still belongs to the production day of the 23rd", new Date(s.prodDate).getDate(), 23, 23);
  run(e, 65, clock);
  const kgAt3 = e.getSnapshot().pcp.days.find((d) => d.dom === 23)?.actualKg ?? 0;
  run(e, 100, clock);
  const s2 = e.getSnapshot();
  const kgLater = s2.pcp.days.find((d) => d.dom === 23)?.actualKg ?? 0;
  check("pcp/config: boxes packed after 03:00 count on the slaughter day (t)", (kgLater - kgAt3) / 1000, 15, 60);
  check("pcp/config: the new production day starts empty (t)", s2.kpi.finishedT, 0, 0);
}

console.log(failures ? `\n${failures} calibration check(s) failed` : "\nAll calibration checks passed");
if (failures) process.exitCode = 1;
