"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Calendar, Target, Award, Clock, ArrowLeft, RefreshCw, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface WeeklyPlan {
  week: number;
  focus: string;
  tasks: string[];
}

interface MockTask {
  date: string;
  test_type: string;
  objective: string;
}

interface StudyPlanData {
  weekly_plans: WeeklyPlan[];
  mock_schedule: MockTask[];
  mentor_advice: string;
  completed_tasks?: string[];
}

export default function PlannerPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Planner states
  const [plan, setPlan] = useState<StudyPlanData | null>(null);
  const [isFetchingPlan, setIsFetchingPlan] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync session client-side
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          toast.error("Please login to view your Study Planner.");
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
      } finally {
        setIsFetchingPlan(false);
      }
    };

    fetchActivePlan();
  }, [token]);

  // Toggle task completion checkmark
  const toggleTask = async (weekNum: number, taskIdx: number) => {
    if (!plan || !token) return;

    const taskKey = `${weekNum}-${taskIdx}`;
    const currentCompleted = plan.completed_tasks || [];
    const isCompleted = currentCompleted.includes(taskKey);

    const updatedCompleted = isCompleted
      ? currentCompleted.filter((k) => k !== taskKey)
      : [...currentCompleted, taskKey];

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
      toast.error("Failed to sync progress with the server.");
      setPlan(plan); // Rollback state
    }
  };

  // Generate planner mutation
  const handleGenerate = async () => {
    if (!token) return;
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
        throw new Error(typeof err?.error === "string" ? err.error : "Failed to generate roadmap.");
      }

      const generated = await res.json();
      setPlan(generated);
      toast.success("Study roadmap generated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to contact planner engine.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isAuthLoading || isFetchingPlan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading study planner...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-muted/50 bg-background/80 backdrop-blur-md px-6 h-16 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 mr-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </a>
          <span className="font-bold text-foreground">Study Roadmap Planner</span>
        </div>
        <a href="/dashboard" className="text-xs font-bold text-primary hover:underline">
          Go to Dashboard
        </a>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        
        {/* Loading / Generate Prompt */}
        {isGenerating && (
          <Card className="shadow-md border-muted/50 p-8 min-h-[400px] flex items-center justify-center">
            <CardContent className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-primary border border-primary/10 shadow-xs">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-lg">Assembling Study Planner</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Our curriculum AI is analyzing your current band goals and weak segments to map daily tasks and milestone timelines.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isGenerating && !plan && (
          <Card className="shadow-md border-muted/50 p-8 min-h-[400px] flex flex-col items-center justify-center text-center space-y-6 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 animate-pulse">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground tracking-tight">Generate Your Study Plan</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                No active plan found. Let our IELTS curriculum engine map out weekly focuses, tasks, and simulator drills customized for your score goals.
              </p>
            </div>
            <Button onClick={handleGenerate} size="lg" className="h-11">
              Generate Free Roadmap
            </Button>
          </Card>
        )}

        {/* Plan display UI */}
        {!isGenerating && plan && (() => {
          const totalTasks = plan.weekly_plans?.reduce((acc, curr) => acc + (curr.tasks?.length || 0), 0) || 0;
          const completedTasks = plan.completed_tasks?.length || 0;
          const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          return (
            <div className="space-y-6 animate-message-appear animate-in">
              {/* Advice banner */}
              <Card className="shadow-sm border-primary/20 bg-primary/5">
                <CardContent className="p-5 flex gap-4 items-start">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-primary">AI Mentor Strategy Note</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {plan.mentor_advice}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Learning Progression Card */}
              <Card className="shadow-xs border-stone-200 bg-white">
                <CardContent className="p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm text-slate-800">Your Learning Progression</h3>
                      <p className="text-[11px] text-muted-foreground font-medium">Keep completing weekly tasks to reach your band goal.</p>
                    </div>
                    <span className="text-sm font-extrabold text-primary font-mono">{progressPercent}% Done</span>
                  </div>
                  <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200/40">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>{completedTasks} / {totalTasks} Tasks Completed</span>
                    <span>Target Weekly Milestone</span>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Focus blocks */}
              <div className="space-y-4">
                <h2 className="text-base font-bold text-foreground">Weekly Milestones</h2>
                <div className="grid grid-cols-1 gap-4">
                  {plan?.weekly_plans?.map((w) => (
                    <Card key={w.week} className="shadow-xs border-muted/50">
                      <CardHeader className="pb-2 bg-muted/10">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            Week {w.week}
                          </span>
                          <CardTitle className="text-sm font-bold text-foreground">
                            {w.focus}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {w?.tasks?.map((task, idx) => {
                            const taskKey = `${w.week}-${idx}`;
                            const isDone = plan.completed_tasks?.includes(taskKey) || false;

                            return (
                              <li 
                                key={idx} 
                                onClick={() => toggleTask(w.week, idx)}
                                className={`flex items-start gap-3 text-xs leading-relaxed border p-3 rounded-xl cursor-pointer transition-all ${
                                  isDone 
                                    ? "bg-stone-50/50 border-stone-200 text-stone-400 line-through opacity-70" 
                                    : "bg-background border-muted/60 hover:border-primary/30 text-muted-foreground hover:text-slate-800"
                                }`}
                              >
                                <input 
                                  type="checkbox" 
                                  checked={isDone}
                                  onChange={() => {}} // Controlled by list item click
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0 mt-0.5 cursor-pointer accent-primary" 
                                />
                                <span>{task}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

            {/* Mock Schedule Table */}
            <Card className="shadow-xs border-muted/50">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Recommended Assessment Schedule</CardTitle>
                <CardDescription>Target testing schedules leading up to your real exam.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-muted/50 text-xs">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-muted-foreground">Timeline</th>
                        <th className="px-4 py-3 text-left font-bold text-muted-foreground">Activity Type</th>
                        <th className="px-4 py-3 text-left font-bold text-muted-foreground">Key Objective</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted/30">
                      {plan?.mock_schedule?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="px-4 py-3 font-semibold text-primary">{item.date}</td>
                          <td className="px-4 py-3 text-foreground font-semibold">{item.test_type}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.objective}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

              {/* Actions */}
              <div className="flex justify-between items-center">
                <Button 
                  onClick={handleGenerate} 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5 text-primary border-primary/20 hover:bg-primary/5 cursor-pointer font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync & Adapt Roadmap
                </Button>
                <a href="/dashboard">
                  <Button size="sm">
                    Go to Dashboard
                  </Button>
                </a>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
