"use client";

import { useState, useMemo } from "react";
import { 
  ChevronRight, 
  ChevronLeft,
  BookOpen, 
  Mic, 
  PenTool, 
  Headset, 
  Award,
  Search,
  ArrowLeft,
  Calendar,
  Filter,
  SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TrackRecordEntry } from "@/lib/track-record";

interface RecordsListProps {
  initialRecords: TrackRecordEntry[];
}

export function RecordsList({ initialRecords }: RecordsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Calculate averages dynamically for each module
  const averages = useMemo(() => {
    const modules = ["Reading", "Writing", "Listening", "Speaking"];
    const result: Record<string, string | null> = {};

    modules.forEach(mod => {
      const attempts = initialRecords.filter(r => r.module === mod && r.score.startsWith("Band "));
      if (attempts.length === 0) {
        result[mod] = null;
        return;
      }
      const sum = attempts.reduce((acc, r) => {
        const val = parseFloat(r.score.replace("Band ", ""));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      result[mod] = (sum / attempts.length).toFixed(1);
    });

    return result;
  }, [initialRecords]);

  // Filter, search, and sort records in memory
  const processedRecords = useMemo(() => {
    let list = [...initialRecords];

    // 1. Filter by Module
    if (selectedModule !== "All") {
      list = list.filter(r => r.module === selectedModule);
    }

    // 2. Search by Title
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      list = list.filter(r => r.title.toLowerCase().includes(query) || r.module.toLowerCase().includes(query));
    }

    // 3. Sort
    list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === "highest" || sortBy === "lowest") {
        const getVal = (scoreStr: string) => {
          if (scoreStr.startsWith("Band ")) {
            const val = parseFloat(scoreStr.replace("Band ", ""));
            return isNaN(val) ? 0 : val;
          }
          return 0; // "Not graded" gets 0
        };
        const valA = getVal(a.score);
        const valB = getVal(b.score);
        return sortBy === "highest" ? valB - valA : valA - valB;
      }
      return 0;
    });

    return list;
  }, [initialRecords, selectedModule, searchQuery, sortBy]);

  // Pagination logic
  const totalPages = Math.ceil(processedRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [processedRecords, currentPage]);

  const handleModuleChange = (module: string) => {
    setSelectedModule(module);
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  // Module configuration for design
  const moduleConfig: Record<string, { bg: string, text: string, icon: any, border: string }> = {
    Reading: { bg: "bg-amber-50 text-blue-950", text: "text-amber-800", icon: BookOpen, border: "border-stone-200" },
    Writing: { bg: "bg-emerald-50 text-emerald-800", text: "text-emerald-800", icon: PenTool, border: "border-emerald-100" },
    Listening: { bg: "bg-blue-50 text-blue-950", text: "text-blue-800", icon: Headset, border: "border-blue-100" },
    Speaking: { bg: "bg-amber-50 text-amber-900", text: "text-amber-800", icon: Mic, border: "border-amber-100/60" }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-slate-800 font-sans relative overflow-hidden flex flex-col justify-between">
      {/* Background Grid Pattern (matching landing/dashboard page) */}
      <div className="absolute inset-0 bg-[radial-gradient(#efebe4_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

      {/* Top ambient lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-blue-950/5 blur-[100px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[450px] h-[450px] rounded-full bg-amber-500/5 blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200/60 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <a href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-950 hover:bg-stone-100 rounded-lg">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </a>
            <span className="font-extrabold text-blue-950 tracking-tight text-lg sm:text-xl">Your Practice Records</span>
          </div>

          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-xs font-bold text-slate-500 hover:text-blue-950">
              Dashboard
            </a>
            <span className="text-slate-300">|</span>
            <a href="/simulator" className="text-xs font-bold text-amber-800 hover:text-blue-950">
              Exam Simulator
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 flex-1 relative z-10 w-full">
        
        {/* Dynamic Averages Dashboard Widgets */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {["Reading", "Writing", "Listening", "Speaking"].map((mod) => {
            const config = moduleConfig[mod];
            const Icon = config.icon;
            const avg = averages[mod];

            return (
              <Card 
                key={mod} 
                className="rounded-2xl border-stone-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.01)] bg-white hover:scale-[1.01] transition-transform duration-200 overflow-hidden"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 p-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{mod}</span>
                  <div className={`p-1.5 rounded-lg ${config.bg} ${config.text}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-left">
                  <div className="text-2xl font-black text-slate-800">
                    {avg ? `Band ${avg}` : "N/A"}
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Average score</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters and Controls container */}
        <div className="bg-white border border-stone-200/60 rounded-2xl p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.01)] space-y-4">
          
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search test records..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400/50 transition-all font-medium placeholder-slate-400"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <SlidersHorizontal className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={handleSortChange}
                className="w-full md:w-44 px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 transition-all font-semibold text-slate-600 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Score</option>
                <option value="lowest">Lowest Score</option>
              </select>
            </div>
          </div>

          {/* Module Filtering Tabs */}
          <div className="flex flex-wrap gap-1.5 border-t border-stone-100 pt-4">
            {["All", "Reading", "Writing", "Listening", "Speaking"].map((mod) => (
              <button
                key={mod}
                onClick={() => handleModuleChange(mod)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedModule === mod 
                    ? "bg-blue-950 text-white shadow-xs" 
                    : "bg-stone-50 text-slate-500 hover:bg-stone-100 hover:text-slate-700 border border-stone-200/50"
                }`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>

        {/* Records Table / Visual List */}
        <Card className="rounded-2xl border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white w-full overflow-hidden text-left">
          <CardContent className="p-0">
            {paginatedRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50/40 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-stone-200/40">
                      <th className="px-6 py-4 text-left">Module</th>
                      <th className="px-6 py-4 text-left">Task / Title</th>
                      <th className="px-6 py-4 text-left">Attempt Date</th>
                      <th className="px-6 py-4 text-left">Score</th>
                      <th className="px-6 py-4 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {paginatedRecords.map((record) => {
                      const config = moduleConfig[record.module] || moduleConfig.Reading;

                      return (
                        <tr key={record.id} className="hover:bg-stone-50/25 transition-colors">
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${config.bg} ${config.text} ${config.border}`}>
                              {record.module}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {record.title}
                          </td>
                          <td className="px-6 py-4 text-slate-400 font-semibold text-xs">
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
                                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
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
                              className="text-xs font-extrabold text-blue-950 hover:text-amber-800 flex items-center gap-0.5 group w-fit"
                            >
                              View details
                              <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 space-y-4">
                <div className="text-5xl">🔍</div>
                <h4 className="font-extrabold text-slate-700">No records found</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto font-medium">
                  Try adjusting your search criteria, selecting a different module tab, or start a new practice test!
                </p>
              </div>
            )}
          </CardContent>

          {/* Table Footer with Pagination Controls */}
          {totalPages > 1 && (
            <div className="border-t border-stone-100 px-6 py-4 flex items-center justify-between bg-stone-50/30">
              <span className="text-xs text-slate-400 font-bold">
                Page {currentPage} of {totalPages} ({processedRecords.length} records total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8 border-stone-200 text-slate-600 rounded-lg hover:bg-stone-100 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="h-8 border-stone-200 text-slate-600 rounded-lg hover:bg-stone-100 flex items-center gap-1 cursor-pointer"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/60 py-8 bg-stone-50 relative z-10 w-full mt-12">
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
