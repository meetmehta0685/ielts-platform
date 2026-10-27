import { redirect } from "next/navigation";
import { requireServerUser } from "@/lib/supabase-server";
import { loadTrackRecord } from "@/lib/track-record";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  BookOpen, 
  GraduationCap, 
  Compass,
  Sparkles,
  MessageSquare,
  Mic,
  PenTool,
  Headset,
  Award
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default async function DashboardPage() {
  const { supabase, user, accessToken } = await requireServerUser("/dashboard");

  const [{ data: profile }, stats, trackRecord] = await Promise.all([
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
  ]);

  // If no profile exists yet, or they haven't finished onboarding, redirect them
  if (!profile || !profile.target_band || !profile.study_hours_per_day || !profile.exam_date) {
    redirect("/complete-profile");
  }

  // Calculate days remaining to exam
  const today = new Date();
  const examDate = new Date(profile.exam_date);
  const diffTime = examDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const daysText = diffDays > 0 ? `${diffDays} days left` : diffDays === 0 ? "Exam is today!" : "Exam passed";

  // Formatted exam date
  const formattedExamDate = examDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-stone-50 text-slate-800 font-sans relative overflow-hidden flex flex-col justify-between">
      {/* Background Grid Pattern (Warm paper grid texture matching landing page) */}
      <div className="absolute inset-0 bg-[radial-gradient(#efebe4_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

      {/* Background ambient light */}
      <div className="absolute top-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-950/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[150px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-stone-200/60 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/dashboard" className="flex items-center">
            <img src="/logo.png" alt="AI IELTS Logo" className="h-20 w-auto object-contain" />
          </a>
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="/planner"
              className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-blue-950 transition-colors"
            >
              Study Roadmap
            </a>
            <a
              href="/simulator"
              className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-blue-950 transition-colors"
            >
              Exam Simulator
            </a>
            <a
              href="/chat"
              className="text-xs sm:text-sm font-semibold text-amber-800 hover:text-blue-950 transition-colors flex items-center gap-1.5 bg-amber-50/50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200/60"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600 fill-amber-500/20 animate-pulse" />
              AI Mentor Chat
            </a>
            <LogoutButton variant="ghost" size="sm" className="font-semibold text-slate-500 hover:text-blue-950" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 flex-1 relative z-10 w-full">
        
        {/* Welcome Section */}
        <div className="rounded-2xl border border-stone-200/60 bg-white bg-gradient-to-r from-amber-500/[0.04] via-stone-50/30 to-transparent p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="space-y-2 text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-blue-950 sm:text-4xl">
              Welcome back, {profile.full_name || "Scholar"}! ✨
            </h1>
            <p className="text-sm text-slate-500 font-medium max-w-xl">
              Track your daily progress, review analytical breakdowns, and practice modular exam sheets with your AI Mentor.
            </p>
          </div>
          <a href="/simulator" className="w-full md:w-auto">
            <Button className="h-11 w-full md:w-auto bg-blue-950 hover:bg-blue-900 text-white font-semibold rounded-xl shadow-md shadow-blue-950/15 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] gap-2">
              <GraduationCap className="h-5 w-5" />
              Start Exam Simulation
            </Button>
          </a>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Target Band score card */}
          <Card className="rounded-2xl border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="text-left">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Target Band Score
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">Your exam goal</CardDescription>
              </div>
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700 border border-amber-100">
                <Target className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-2 text-left">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-slate-800">
                  Band {Number(profile.target_band).toFixed(1)}
                </span>
                {profile.current_band && (
                  <span className="text-xs text-slate-400 font-semibold bg-stone-50 px-2 py-0.5 rounded border border-stone-200/60">
                    Baseline: {Number(profile.current_band).toFixed(1)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline exam date card */}
          <Card className="rounded-2xl border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="text-left">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Exam Timeline
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">{daysText}</CardDescription>
              </div>
              <div className="rounded-xl bg-stone-50 p-2.5 text-slate-700 border border-stone-200/60">
                <Calendar className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-2 text-left">
              <span className="text-lg font-bold text-slate-700 block truncate">
                {formattedExamDate}
              </span>
            </CardContent>
          </Card>

          {/* Daily Study Hours Card */}
          <Card className="rounded-2xl border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white hover:shadow-md transition-all duration-300 sm:col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="text-left">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Study Commitment
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">Recommended daily review</CardDescription>
              </div>
              <div className="rounded-xl bg-blue-50/80 p-2.5 text-blue-950 border border-blue-100/60">
                <Clock className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-2 text-left">
              <span className="text-4xl font-extrabold text-slate-800">
                {profile.study_hours_per_day} hrs
              </span>
              <span className="text-xs font-semibold text-slate-400 ml-1">/ day</span>
            </CardContent>
          </Card>
        </div>

        {/* Recharts Analytics Charts */}
        <DashboardCharts 
          history={stats?.history || []} 
          averages={stats?.averages || { writing: 0, speaking: 0, reading: 0, listening: 0 }} 
          targetBand={Number(profile.target_band)} 
        />

        {/* Bottom Modules & Focus Area Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Weak Focus Areas */}
          <Card className="rounded-2xl border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white lg:col-span-1 flex flex-col justify-between">
            <div>
              <CardHeader className="text-left">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-blue-950">
                  <AlertTriangle className="h-5 w-5 text-amber-700 fill-amber-50/50" />
                  Focus Modules
                </CardTitle>
                <CardDescription className="text-slate-400 font-medium">
                  Areas requiring your primary attention
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {profile.weak_areas && profile.weak_areas.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {profile.weak_areas.map((area: string) => (
                      <div
                        key={area}
                        className="flex items-center justify-between rounded-xl border border-amber-200/50 bg-amber-50/50 px-3.5 py-2.5 text-sm text-slate-700 font-semibold"
                      >
                        <span>{area}</span>
                        <Badge variant="outline" className="border-amber-200 text-amber-700 bg-white text-[10px] font-bold">
                          High Priority
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 font-medium py-4">No weak areas identified!</p>
                )}
              </CardContent>
            </div>

            <CardContent className="pb-6 pt-2">
              {/* Study Plan quick links */}
              <div className="pt-4 border-t border-stone-100">
                <a href="/planner" className="flex items-center justify-between text-xs font-bold text-blue-950 hover:text-amber-800 transition-colors">
                  <span className="flex items-center gap-1.5">
                    <Compass className="h-4 w-4" />
                    View Study Roadmap
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Quick Practice Modules */}
          <Card className="rounded-2xl border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white lg:col-span-2 text-left">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-blue-950">
                <BookOpen className="h-5 w-5 text-amber-600" />
                Start Preparing
              </CardTitle>
              <CardDescription className="text-slate-400 font-medium">
                Click any of the modules below to start practicing with AI tutors
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {["Reading", "Writing", "Listening", "Speaking"].map((module) => {
                const path = `/${module.toLowerCase()}`;
                const isWeakArea = profile.weak_areas?.includes(module);
                const avgScore = stats?.averages?.[module.toLowerCase()];

                // Module specific design details
                const moduleStyles: Record<string, { bg: string, text: string, hover: string, icon: any }> = {
                  Reading: { bg: "bg-amber-50/80", text: "text-blue-950", hover: "hover:border-amber-400/80 hover:bg-stone-50/50", icon: BookOpen },
                  Writing: { bg: "bg-amber-50/80", text: "text-blue-950", hover: "hover:border-amber-400/80 hover:bg-stone-50/50", icon: PenTool },
                  Listening: { bg: "bg-amber-50/80", text: "text-blue-950", hover: "hover:border-amber-400/80 hover:bg-stone-50/50", icon: Headset },
                  Speaking: { bg: "bg-amber-50/80", text: "text-blue-950", hover: "hover:border-amber-400/80 hover:bg-stone-50/50", icon: Mic }
                };

                const style = moduleStyles[module] || moduleStyles.Reading;
                const IconComponent = style.icon;

                return (
                  <a
                    key={module}
                    href={path}
                    className={`group relative flex items-center justify-between rounded-xl border border-stone-200/60 p-4.5 transition-all duration-200 hover:-translate-y-0.5 ${style.hover} cursor-pointer shadow-xs bg-white`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`rounded-xl ${style.bg} p-2.5 ${style.text} transition-colors duration-200`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 transition-colors">
                            {module} Prep
                          </span>
                          {isWeakArea && (
                            <Badge variant="default" className="text-[10px] font-bold px-2 py-0 bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100">
                              Focus
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-1">
                          {avgScore > 0 ? `Current avg: Band ${avgScore.toFixed(1)}` : "No attempts recorded yet"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-950 group-hover:translate-x-0.5 transition-all" />
                  </a>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Performance Track Record Section */}
        <Card className="rounded-2xl border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white w-full text-left mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-blue-950">
              <Award className="h-5 w-5 text-amber-600" />
              Performance Track Record
            </CardTitle>
            <CardDescription className="text-slate-400 font-medium">
              Detailed history of all practice attempts and evaluations across modules
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {trackRecord.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50/40 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-stone-200/40">
                      <th className="px-6 py-3.5 text-left">Module</th>
                      <th className="px-6 py-3.5 text-left">Task / Title</th>
                      <th className="px-6 py-3.5 text-left">Attempt Date</th>
                      <th className="px-6 py-3.5 text-left">Score</th>
                      <th className="px-6 py-3.5 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {trackRecord.slice(0, 5).map((record) => {
                      const moduleStyles: Record<string, { bg: string }> = {
                        Reading: { bg: "bg-slate-100 text-slate-600 border-stone-200/60" },
                        Writing: { bg: "bg-emerald-50 text-emerald-800 border-emerald-100/60" },
                        Listening: { bg: "bg-slate-100 text-slate-600 border-stone-200/60" },
                        Speaking: { bg: "bg-amber-100/60 text-amber-800 border-amber-200/40" }
                      };
                      const style = moduleStyles[record.module] || moduleStyles.Reading;

                      return (
                        <tr key={record.id} className="hover:bg-stone-50/20 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${style.bg}`}>
                              {record.module}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            {record.title}
                          </td>
                          <td className="px-6 py-4 text-slate-400 font-medium">
                            {new Date(record.date).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-700">{record.score}</span>
                              {record.rawScore && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Raw: {record.rawScore}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <a 
                              href={
                                record.module === "Writing" ? `/writing?attempt_id=${record.id}` :
                                record.module === "Speaking" ? `/speaking?attempt_id=${record.id}` :
                                record.module === "Reading" ? `/reading?attempt_id=${record.id}` :
                                `/listening?attempt_id=${record.id}`
                              }
                              className="text-xs font-bold text-blue-950 hover:text-amber-800 flex items-center gap-1 w-fit"
                            >
                              View Details
                              <ChevronRight className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {trackRecord.length > 5 && (
                  <div className="mt-4 pt-4 border-t border-stone-100 flex justify-center">
                    <a
                      href="/records"
                      className="text-xs font-extrabold text-blue-950 hover:text-amber-850 transition-colors flex items-center gap-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200/60 px-4 py-2 rounded-xl hover:scale-[1.01] transition-transform duration-150"
                    >
                      See All {trackRecord.length} Records
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <div className="text-4xl">📊</div>
                <h4 className="font-bold text-slate-700 text-sm">No attempts recorded yet</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Start practicing reading, writing, speaking, or listening drills to track your band progression logs here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Floating AI Mentor Chat FAB */}
      <a 
        href="/chat" 
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-950 to-blue-900 text-white shadow-lg shadow-blue-950/20 hover:scale-105 hover:shadow-xl hover:shadow-blue-950/35 active:scale-95 transition-all duration-200 group border border-white/20"
        aria-label="Chat with AI Mentor"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-950 to-blue-900 blur-[8px] opacity-40 group-hover:opacity-60 transition-opacity animate-pulse" />
        <div className="relative flex items-center justify-center">
          <MessageSquare className="h-6 w-6 stroke-[2]" />
          <Sparkles className="absolute -top-1 -right-1.5 h-3.5 w-3.5 text-amber-300 fill-amber-300 animate-pulse" />
        </div>
      </a>

      {/* Footer */}
      <footer className="border-t border-stone-200/60 py-8 bg-stone-50 relative z-10 w-full">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="/logo.png" alt="AI IELTS Logo" className="h-20 w-auto object-contain" />
          </div>
          <p className="text-xs text-slate-400 font-medium">
            &copy; {new Date().getFullYear()} IELTS Guidance Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

