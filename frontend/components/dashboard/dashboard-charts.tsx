"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartHistoryItem {
  index: number;
  event: string;
  score: number;
}

interface DashboardChartsProps {
  history: ChartHistoryItem[];
  averages: {
    writing: number;
    speaking: number;
    reading: number;
    listening: number;
  };
  targetBand: number;
}

export function DashboardCharts({ history, averages, targetBand }: DashboardChartsProps) {
  // Convert averages to structured array for BarChart comparisons
  const barData = [
    { name: "Listening", Current: averages.listening, Target: targetBand },
    { name: "Reading", Current: averages.reading, Target: targetBand },
    { name: "Writing", Current: averages.writing, Target: targetBand },
    { name: "Speaking", Current: averages.speaking, Target: targetBand },
  ];

  // Provide generic mockup history points if none are present to keep UI pristine
  const displayHistory = history.length > 0 ? history : [
    { event: "Start", score: 5.5 },
    { event: "Reading Drill", score: 6.0 },
    { event: "Writing Essay", score: 6.5 },
    { event: "Speaking Prep", score: 6.5 },
    { event: "Listening Drill", score: 7.0 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Score Progression (AreaChart) */}
      <Card className="rounded-2xl border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white hover:shadow-md transition-all duration-300">
        <CardHeader className="text-left">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-400">Score Progression</CardTitle>
          <CardDescription className="text-xs text-slate-400">Estimated bands of your latest 5 practice attempts</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#172554" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#172554" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#efebe4" />
              <XAxis dataKey="event" tick={{ fontSize: 9, fill: "#94a3b8" }} stroke="#efebe4" />
              <YAxis domain={[1, 9]} tickCount={9} stroke="#efebe4" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: "12px", 
                  border: "1px solid #efebe4",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                  backgroundColor: "#ffffff"
                }}
              />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#172554" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#scoreColor)"
                activeDot={{ r: 6, strokeWidth: 0, fill: "#172554" }} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Target vs Actual Comparison (BarChart) */}
      <Card className="rounded-2xl border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white hover:shadow-md transition-all duration-300">
        <CardHeader className="text-left">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-400">Module Breakdown</CardTitle>
          <CardDescription className="text-xs text-slate-400">Comparing average scores vs target exam bands</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#efebe4" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} stroke="#efebe4" />
              <YAxis domain={[1, 9]} tickCount={9} stroke="#efebe4" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: "12px", 
                  border: "1px solid #efebe4",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)",
                  backgroundColor: "#ffffff"
                }}
              />
              <Bar dataKey="Current" fill="#172554" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Target" fill="#efebe4" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

