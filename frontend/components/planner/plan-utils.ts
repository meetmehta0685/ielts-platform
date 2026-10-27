export interface WeeklyPlan {
  week: number;
  focus: string;
  tasks: string[];
}

export interface MockTask {
  date: string;
  test_type: string;
  objective: string;
}

export interface StudyPlanData {
  weekly_plans: WeeklyPlan[];
  mock_schedule: MockTask[];
  mentor_advice: string;
  completed_tasks?: string[];
}

/** The key a ticked task is stored under in `completed_tasks`. */
export const taskKey = (week: number, taskIdx: number) => `${week}-${taskIdx}`;

/** Counts only keys that match a task in the plan, so stale keys never inflate progress. */
export function planProgress(plan: StudyPlanData) {
  const done = new Set(plan.completed_tasks ?? []);
  let total = 0;
  let completed = 0;
  for (const w of plan.weekly_plans ?? []) {
    (w.tasks ?? []).forEach((_, i) => {
      total += 1;
      if (done.has(taskKey(w.week, i))) completed += 1;
    });
  }
  return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
}

/** This week is the first week that still has an unticked task; the last week once all are done. */
export function currentWeekIndex(plan: StudyPlanData) {
  const weeks = plan.weekly_plans ?? [];
  const done = new Set(plan.completed_tasks ?? []);
  const idx = weeks.findIndex((w) => (w.tasks ?? []).some((_, i) => !done.has(taskKey(w.week, i))));
  return idx === -1 ? Math.max(weeks.length - 1, 0) : idx;
}

/** The next mock on or after this week; mock dates are either "Week 3" or a YYYY-MM-DD date. */
export function nextMock(plan: StudyPlanData, weekNumber: number): MockTask | null {
  const today = new Date().toISOString().slice(0, 10);
  for (const m of plan.mock_schedule ?? []) {
    const week = /week\s*(\d+)/i.exec(m.date);
    if (week && Number(week[1]) >= weekNumber) return m;
    if (/^\d{4}-\d{2}-\d{2}$/.test(m.date) && m.date >= today) return m;
  }
  return null;
}

/** "Week 3" stays as it is; an ISO date reads as "Fri 4 Dec". */
export function mockWhen(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }
  return date;
}
