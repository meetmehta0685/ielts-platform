import Link from "next/link";
import { redirect } from "next/navigation";
import { requireServerUser } from "@/lib/supabase-server";
import { loadTrackRecord, type TrackRecordEntry } from "@/lib/track-record";
import { AppShell, PageColumn, Panel } from "@/components/app/app-shell";
import { MODULE_HUE } from "@/lib/module-hue";
import { Button } from "@/components/ui/button";
import { BandTrend, type BandPoint } from "@/components/dashboard/band-trend";
import { PlanTick } from "@/components/dashboard/plan-tick";
import {
  currentWeekIndex,
  mockWhen,
  nextMock,
  taskKey,
  type StudyPlanData,
} from "@/components/planner/plan-utils";
import { attemptHref, bandOf, formatBand } from "@/components/records/record-utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** IELTS order: the test is sat Listening, Reading, Writing, then Speaking. */
const MODULES = [
  { key: "listening", name: "Listening", unit: ["test", "tests"] },
  { key: "reading", name: "Reading", unit: ["test", "tests"] },
  { key: "writing", name: "Writing", unit: ["essay", "essays"] },
  { key: "speaking", name: "Speaking", unit: ["answer", "answers"] },
] as const;

type ModuleName = (typeof MODULES)[number]["name"];

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });


export default async function DashboardPage() {
  const { supabase, user, accessToken } = await requireServerUser("/dashboard");

  const [{ data: profile }, stats, trackRecord, planResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    fetch(`${BACKEND_URL}/api/dashboard/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch((err) => {
        console.error("Failed to fetch dashboard stats:", err);
        return null;
      }),
    loadTrackRecord(supabase, user.id),
    supabase.from("study_plans").select("plan_json").eq("user_id", user.id).maybeSingle(),
  ]);

  // If no profile exists yet, or they haven't finished onboarding, redirect them
  if (!profile || !profile.target_band || !profile.study_hours_per_day || !profile.exam_date) {
    redirect("/complete-profile");
  }

  const target = Number(profile.target_band);
  const firstName =
    (profile.full_name as string | null)?.trim().split(/\s+/)[0] ||
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    "Hello";

  // Calculate days remaining to exam
  const today = new Date();
  const examDate = new Date(profile.exam_date);
  const diffDays = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const title =
    diffDays > 1
      ? `${firstName}, ${diffDays} days to your exam.`
      : diffDays === 1
        ? `${firstName}, your exam is tomorrow.`
        : diffDays === 0
          ? `${firstName}, your exam is today.`
          : `${firstName}, your exam date has passed.`;
  const examDay = examDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Per-module figures. The backend's averages are used when they load; otherwise the same
  // average is computed from the track record so the tiles never go blank on a backend hiccup.
  const graded = trackRecord.filter((r) => bandOf(r) != null);
  const perModule = MODULES.map((m) => {
    const rows = graded.filter((r) => r.module === m.name);
    const fromStats = stats?.averages?.[m.key];
    const avg =
      rows.length === 0
        ? null
        : typeof fromStats === "number" && fromStats > 0
          ? fromStats
          : rows.reduce((a, r) => a + (bandOf(r) ?? 0), 0) / rows.length;
    return { ...m, count: rows.length, avg };
  });

  // The practice to start: the first focus module, else the lowest average, else Writing.
  const weakAreas: string[] = Array.isArray(profile.weak_areas) ? profile.weak_areas : [];
  const lowest = [...perModule].filter((m) => m.avg != null).sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];
  const practise: ModuleName =
    (MODULES.find((m) => m.name === weakAreas[0])?.name as ModuleName | undefined) ?? lowest?.name ?? "Writing";

  const points: BandPoint[] = [...graded]
    .reverse()
    .slice(-12)
    .map((r) => ({ t: new Date(r.date).getTime(), band: bandOf(r)!, module: r.module, title: r.title }));

  const plan = (planResult.data?.plan_json ?? null) as StudyPlanData | null;
  const planFailed = Boolean(planResult.error);
  const hasPlan = Boolean(plan?.weekly_plans?.length);

  // Distance to target for every module, lowest first; focus modules are named in ink.
  const gapRows = [...perModule].sort((a, b) => (a.avg ?? -1) - (b.avg ?? -1));
  const SCALE_LO = 4;
  const pos = (band: number) => `${Math.min(Math.max((band - SCALE_LO) / (9 - SCALE_LO), 0), 1) * 100}%`;

  return (
    <AppShell title="Home">
      <PageColumn
        title={title}
        lead={
          <>
            Aiming for Band {target.toFixed(1)} on {examDay}, studying {profile.study_hours_per_day}{" "}
            {Number(profile.study_hours_per_day) === 1 ? "hour" : "hours"} a day.{" "}
            <Link
              href="/complete-profile"
              className="whitespace-nowrap text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              Change
            </Link>
          </>
        }
        actions={
          <>
            <Button asChild variant="accent">
              <Link href={`/${practise.toLowerCase()}`}>Practise {practise}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/simulator">Sit the full mock</Link>
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-12">
          {/* Your bands: one strip, a column per module */}
          <section aria-label="Average band per module" className="tile col-span-2 grid grid-cols-2 overflow-hidden lg:col-span-12 lg:grid-cols-4">
            {perModule.map((m, i) => (
              <Link
                key={m.key}
                href={`/${m.key}`}
                className={`group flex flex-col gap-6 p-5 transition-colors duration-[var(--duration-quick)] hover:bg-panel focus-visible:-outline-offset-2 sm:p-6 ${
                  i % 2 === 1 ? "border-l border-border" : ""
                } ${i >= 2 ? "border-t border-border lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
              >
                <span className="flex items-center justify-between gap-2 text-[15px] font-medium text-ink">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className={`size-2 rounded-full ${MODULE_HUE[m.name]}`} />
                    {m.name}
                  </span>
                  <span className="hidden text-sm font-normal text-soft underline-offset-4 group-hover:text-ink group-hover:underline sm:inline">
                    Practise
                  </span>
                </span>
                <span>
                  {m.avg != null ? (
                    <span className="tabular block font-display text-[36px] tracking-[-0.02em] text-ink">{m.avg.toFixed(1)}</span>
                  ) : (
                    <span className="block text-[17px] leading-[36px] text-soft">Not tried yet</span>
                  )}
                  <span className="mt-1 block text-sm text-soft">
                    {m.count === 0 ? `Target ${target.toFixed(1)}` : `${m.count} ${m.unit[m.count === 1 ? 0 : 1]} marked`}
                  </span>
                </span>
              </Link>
            ))}
          </section>

          {/* 9: the main chart */}
          <Panel
            title="Band per marked attempt"
            aside={points.length > 0 ? `Latest ${points.length} of ${graded.length}` : undefined}
            className="col-span-2 lg:col-span-9"
          >
            <div>
              {points.length === 0 ? (
                <div className="flex min-h-[140px] flex-col items-start justify-center gap-3 lg:h-[248px]">
                  <p className="max-w-[46ch] text-[15px] text-soft">
                    Each marked essay, recording and test lands here as a point, against your target of Band{" "}
                    {target.toFixed(1)}. Nothing is marked yet.
                  </p>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/${practise.toLowerCase()}`}>Start with {practise}</Link>
                  </Button>
                </div>
              ) : (
                <BandTrend points={points} target={target} />
              )}
            </div>
          </Panel>

          {/* 3: this week's plan */}
          <Panel
            title="This week's plan"
            aside={hasPlan && plan ? `Week ${plan.weekly_plans[currentWeekIndex(plan)].week} of ${plan.weekly_plans.length}` : undefined}
            className="col-span-2 flex flex-col lg:col-span-3"
          >
            {planFailed ? (
              <p className="text-[15px] text-soft">Your plan didn&apos;t load. Refresh to try again.</p>
            ) : !hasPlan || !plan ? (
              <div className="flex flex-1 flex-col justify-between gap-4">
                <p className="text-[15px] text-soft">
                  No study plan yet. Build one from your target band, exam date and scores so far.
                </p>
                <Button asChild variant="secondary" size="sm" className="self-start">
                  <Link href="/planner">Build my plan</Link>
                </Button>
              </div>
            ) : (
              (() => {
                const week = plan.weekly_plans[currentWeekIndex(plan)];
                const done = new Set(plan.completed_tasks ?? []);
                const doneHere = week.tasks.filter((_, i) => done.has(taskKey(week.week, i))).length;
                return (
                  <div className="flex flex-1 flex-col justify-between gap-4">
                    <div>
                      <p className="text-[15px] font-medium text-ink">{week.focus}</p>
                      <ul className="mt-3 flex flex-col gap-2.5">
                        {week.tasks.map((task, i) => (
                          <li key={i} className="flex gap-2.5 text-sm leading-snug">
                            <PlanTick done={done.has(taskKey(week.week, i))} />
                            <span className={done.has(taskKey(week.week, i)) ? "text-soft" : "text-ink"}>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-border pt-3 text-sm">
                      <span className="tabular text-soft">
                        {doneHere} of {week.tasks.length} done
                      </span>
                      <Link href="/planner" className="text-ink underline decoration-1 underline-offset-4 hover:decoration-2">
                        Open plan
                      </Link>
                    </div>
                  </div>
                );
              })()
            )}
          </Panel>

          {/* 6: recent results */}
          <Panel
            title="Recent results"
            aside={
              trackRecord.length > 0 ? (
                <Link href="/records" className="text-ink underline decoration-1 underline-offset-4 hover:decoration-2">
                  View all {trackRecord.length}
                </Link>
              ) : undefined
            }
            className="col-span-2 lg:col-span-6"
          >
            {trackRecord.length === 0 ? (
              <p className="text-[15px] text-soft">
                No attempts yet. Marked essays, speaking answers and tests will be listed here, newest first.
              </p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {trackRecord.slice(0, 5).map((r) => (
                  <RecentRow key={`${r.module}-${r.id}`} record={r} />
                ))}
              </ul>
            )}
          </Panel>

          {/* 6: distance to target per module, and the next mock */}
          <Panel
            title={`Distance to Band ${target.toFixed(1)}`}
            aside={<span className="hidden sm:inline">{weakAreas.length ? `Focus: ${weakAreas.join(", ")}` : "Lowest first"}</span>}
            className="col-span-2 flex flex-col lg:col-span-6"
          >
            <ul className="flex flex-col">
              {gapRows.map((m) => {
                const gap = m.avg != null ? target - m.avg : null;
                const focus = weakAreas.includes(m.name);
                return (
                  <li key={m.key} className="grid h-11 grid-cols-[84px_1fr_96px] items-center gap-4">
                    <span className={focus ? "text-[15px] font-medium text-ink" : "text-[15px] text-soft"}>{m.name}</span>
                    <span className="relative h-2 rounded-full bg-panel-strong" aria-hidden>
                      {m.avg != null && (
                        <span
                          className={`absolute inset-y-0 left-0 rounded-full ${MODULE_HUE[m.name]} ${focus ? "" : "opacity-35"}`}
                          style={{ width: pos(m.avg) }}
                        />
                      )}
                      <span className="absolute -top-1 -bottom-1 w-px bg-ink" style={{ left: pos(target) }} />
                    </span>
                    <span className="tabular text-right text-sm text-soft">
                      {gap == null ? "No attempts" : gap <= 0 ? <span className="text-good">At target</span> : <><span className="text-ink">{gap.toFixed(1)}</span> to go</>}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 mb-5 text-[13px] text-soft">Bars run from Band {SCALE_LO} to 9; the tick is your target.</p>
            <div className="mt-auto border-t border-border pt-4">
              {(() => {
                const mock = hasPlan && plan ? nextMock(plan, plan.weekly_plans[currentWeekIndex(plan)].week) : null;
                return mock ? (
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm text-soft">Next mock</p>
                      <p className="mt-1 text-[15px] text-ink">
                        <span className="font-medium">{mockWhen(mock.date)}</span> · {mock.test_type}
                      </p>
                      <p className="mt-0.5 text-sm text-soft">{mock.objective}</p>
                    </div>
                    <Link
                      href="/simulator"
                      className="shrink-0 text-sm text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
                    >
                      Open the mock
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-soft">
                    {hasPlan ? "No mock left on your plan." : "Mock dates come with your study plan."}
                  </p>
                );
              })()}
            </div>
          </Panel>
        </div>
      </PageColumn>
    </AppShell>
  );
}

function RecentRow({ record }: { record: TrackRecordEntry }) {
  return (
    <li>
      <Link
        href={attemptHref(record)}
        className="flex items-center justify-between gap-4 rounded-[10px] px-2 py-2.5 transition-colors duration-[var(--duration-quick)] hover:bg-panel-strong focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="min-w-0">
          <span className="block truncate text-[15px] text-ink">{record.title}</span>
          <span className="flex items-center gap-1.5 text-sm text-soft">
            <span aria-hidden className={`size-1.5 rounded-full ${MODULE_HUE[record.module] ?? "bg-line-strong"}`} />
            {record.module} · {shortDate(record.date)}
          </span>
        </span>
        <span className="tabular shrink-0 text-[17px] text-ink">{formatBand(record)}</span>
      </Link>
    </li>
  );
}
