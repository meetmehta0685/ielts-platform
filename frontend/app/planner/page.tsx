"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell, PageColumn, Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskCheck } from "@/components/planner/task-check";
import {
  currentWeekIndex,
  mockWhen,
  planProgress,
  taskKey,
  type StudyPlanData,
} from "@/components/planner/plan-utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PlannerPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Planner states
  const [plan, setPlan] = useState<StudyPlanData | null>(null);
  const [isFetchingPlan, setIsFetchingPlan] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync session client-side
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          toast.error("Sign in to see your study plan.");
          router.push("/auth/login?redirect=/planner");
        } else {
          setToken(session.access_token);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsAuthLoading(false);
      }
    };
    fetchSession();
  }, [router]);

  // Fetch active plan
  useEffect(() => {
    if (!token) return;

    const fetchActivePlan = async () => {
      setFetchFailed(false);
      try {
        const res = await fetch(`${BACKEND_URL}/api/planner/active`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error("Failed to load active planner");
        const data = await res.json();
        if (data && data.weekly_plans) {
          setPlan(data);
        } else if (data && data.plan_json) {
          setPlan(data.plan_json);
        } else {
          setPlan(null);
        }
      } catch (err) {
        console.error(err);
        setFetchFailed(true);
      } finally {
        setIsFetchingPlan(false);
      }
    };

    fetchActivePlan();
  }, [token, reloadKey]);

  // Toggle task completion checkmark
  const toggleTask = async (weekNum: number, taskIdx: number) => {
    if (!plan || !token) return;

    const key = taskKey(weekNum, taskIdx);
    const currentCompleted = plan.completed_tasks || [];
    const isCompleted = currentCompleted.includes(key);

    const updatedCompleted = isCompleted
      ? currentCompleted.filter((k) => k !== key)
      : [...currentCompleted, key];

    const updatedPlan = {
      ...plan,
      completed_tasks: updatedCompleted,
    };

    setPlan(updatedPlan);

    try {
      const res = await fetch(`${BACKEND_URL}/api/planner/active`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_json: updatedPlan }),
      });

      if (!res.ok) throw new Error();
    } catch (err) {
      console.error(err);
      toast.error("That tick didn't save. Try again.");
      setPlan(plan); // Rollback state
    }
  };

  // Generate planner mutation
  const handleGenerate = async () => {
    if (!token) return;
    if (plan && planProgress(plan).completed > 0) {
      const ok = window.confirm("Rebuilding replaces this plan and clears the tasks you have ticked. Rebuild it?");
      if (!ok) return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/planner/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(typeof err?.error === "string" ? err.error : "The plan didn't build. Try again.");
      }

      const generated = await res.json();
      setPlan(generated);
      setFetchFailed(false);
      toast.success("Your study plan is ready.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach the planner. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppShell title="Study plan">
      {isAuthLoading || isFetchingPlan ? (
        <LoadingState />
      ) : isGenerating ? (
        <GeneratingState />
      ) : fetchFailed && !plan ? (
        <PageColumn
          title="Your plan didn't load."
          lead="The planner didn't answer. Your ticks are safe; try again in a moment."
          actions={
            <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          }
        >
          {null}
        </PageColumn>
      ) : !plan || !plan.weekly_plans?.length ? (
        <PageColumn
          title="No study plan yet."
          lead="Build a week-by-week plan from your target band, your exam date and the scores you have so far. It takes about half a minute."
          actions={
            <Button variant="accent" onClick={handleGenerate}>
              Build my plan
            </Button>
          }
        >
          <p className="max-w-[60ch] text-[15px] text-soft">
            Each week gets a focus and three or four tasks you can tick off, with mock tests placed before your exam.
            You can rebuild it whenever your scores move.
          </p>
        </PageColumn>
      ) : (
        <PlanView plan={plan} onToggle={toggleTask} onRebuild={handleGenerate} />
      )}
    </AppShell>
  );
}

function PlanView({
  plan,
  onToggle,
  onRebuild,
}: {
  plan: StudyPlanData;
  onToggle: (week: number, taskIdx: number) => void;
  onRebuild: () => void;
}) {
  const { total, completed, percent } = planProgress(plan);
  const currentIdx = currentWeekIndex(plan);
  const current = plan.weekly_plans[currentIdx];
  const done = new Set(plan.completed_tasks ?? []);
  const allDone = total > 0 && completed === total;

  return (
    <PageColumn
      title={`${completed} of ${total} tasks done.`}
      lead={
        allDone ? (
          "Every week is ticked off. Rebuild the plan to get the next set."
        ) : (
          <>
            Week {current.week} of {plan.weekly_plans.length}: {current.focus}.
          </>
        )
      }
      actions={
        <Button variant="secondary" onClick={onRebuild}>
          Rebuild plan
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-8 lg:grid-cols-12">
        {/* The weeks, as one vertical plan */}
        <ol className="flex flex-col lg:col-span-8" aria-label="Weekly plan">
          {plan.weekly_plans.map((w, wi) => {
            const isCurrent = wi === currentIdx && !allDone;
            const weekDone = w.tasks.filter((_, i) => done.has(taskKey(w.week, i))).length;
            const complete = weekDone === w.tasks.length && w.tasks.length > 0;
            return (
              <li
                key={w.week}
                className={cn(
                  "grid gap-x-6 gap-y-2 sm:grid-cols-[96px_1fr]",
                  isCurrent ? "my-2 rounded-2xl bg-panel p-5 first:mt-0" : "border-t border-border px-5 py-5 first:border-t-0",
                  wi === currentIdx + 1 && "border-t-0"
                )}
              >
                <div className="flex items-baseline gap-3 sm:flex-col sm:gap-1">
                  <span className="text-[15px] font-medium text-ink">Week {w.week}</span>
                  <span className={cn("text-sm", complete ? "text-good" : "text-soft")}>
                    {isCurrent ? "This week" : complete ? "Done" : wi < currentIdx ? "Unfinished" : "Coming up"}
                  </span>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-[17px] font-medium text-ink">{w.focus}</h2>
                    <span className="tabular shrink-0 text-sm text-soft">
                      {weekDone} of {w.tasks.length}
                    </span>
                  </div>
                  <ul className="mt-2 flex flex-col">
                    {w.tasks.map((task, i) => (
                      <li key={i}>
                        <TaskCheck
                          checked={done.has(taskKey(w.week, i))}
                          label={task}
                          onToggle={() => onToggle(w.week, i)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Progress, mocks and the mentor's note */}
        <aside className="flex flex-col gap-4 lg:col-span-4">
          <Panel title="Progress">
            <p className="tabular text-[30px] leading-none text-ink">
              <span key={percent} className="t-pop">
                {percent}%
              </span>
            </p>
            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-panel-strong"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={completed}
              aria-label="Tasks done"
            >
              <div
                className="t-progress-fill h-full w-full rounded-full bg-brand"
                style={{ transform: `scaleX(${total ? completed / total : 0})` }}
              />
            </div>
            <div className="tabular mt-2 flex justify-between text-sm text-soft">
              <span>{completed} done</span>
              <span>{total} tasks</span>
            </div>
          </Panel>

          <Panel title="Mock tests" aside={plan.mock_schedule?.length ? `${plan.mock_schedule.length} planned` : undefined}>
            {plan.mock_schedule?.length ? (
              <ul className="flex flex-col">
                {plan.mock_schedule.map((m, i) => (
                  <li key={i} className="grid grid-cols-[72px_1fr] gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                    <span className="text-[15px] font-medium text-ink">{mockWhen(m.date)}</span>
                    <span>
                      <span className="block text-[15px] text-ink">{m.test_type}</span>
                      <span className="block text-sm text-soft">{m.objective}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-soft">No mocks on this plan.</p>
            )}
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <Link href="/simulator">Open the full mock</Link>
            </Button>
          </Panel>

          {plan.mentor_advice && (
            <Panel title="From your mentor">
              <p className="text-[15px] leading-relaxed text-ink">{plan.mentor_advice}</p>
              <Link
                href="/chat"
                className="mt-3 inline-block text-sm text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                Ask a follow-up
              </Link>
            </Panel>
          )}
        </aside>
      </div>
    </PageColumn>
  );
}

function WeekSkeletons() {
  return (
    <div className="flex flex-col gap-6 lg:w-2/3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-6 border-t border-border pt-5 first:border-t-0 sm:grid-cols-[96px_1fr]">
          <div className="t-skel h-5 w-16" />
          <div className="flex flex-col gap-3">
            <div className="t-skel h-5 w-2/3" />
            <div className="t-skel h-4 w-full" />
            <div className="t-skel h-4 w-5/6" />
            <div className="t-skel h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <PageColumn
      title={<span className="t-skel inline-block h-[0.8em] w-[min(420px,80vw)] align-middle" aria-label="Loading your plan" />}
      lead={<span className="t-skel inline-block h-4 w-72 align-middle" />}
    >
      <WeekSkeletons />
    </PageColumn>
  );
}

function GeneratingState() {
  return (
    <PageColumn
      title="Building your plan"
      lead={
        <span role="status" aria-live="polite" className="t-shimmer">
          Reading your target band, exam date and recent scores
        </span>
      }
    >
      <WeekSkeletons />
    </PageColumn>
  );
}
