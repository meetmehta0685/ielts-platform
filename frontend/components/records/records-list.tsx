"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { AppShell, PageColumn } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TrackRecordEntry } from "@/lib/track-record";
import { MODULE_HUE } from "@/lib/module-hue";
import { cn } from "@/lib/utils";
import { attemptHref, bandOf, formatBand } from "./record-utils";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface RecordsListProps {
  initialRecords: TrackRecordEntry[];
}

/** IELTS order: Listening, Reading, Writing, Speaking. */
const MODULES = ["Listening", "Reading", "Writing", "Speaking"] as const;
type Filter = "All" | (typeof MODULES)[number];
type Sort = "newest" | "oldest" | "highest" | "lowest";

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest band" },
  { value: "lowest", label: "Lowest band" },
];

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function RecordsList({ initialRecords }: RecordsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<Filter>("All");
  const [sortBy, setSortBy] = useState<Sort>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Per module: latest band, first band, average, and how many marked attempts.
  const moduleSummary = useMemo(() => {
    return MODULES.map((mod) => {
      const attempts = initialRecords
        .filter((r) => r.module === mod && bandOf(r) != null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (attempts.length === 0) return { mod, count: 0, latest: null, first: null, avg: null };
      const bands = attempts.map((r) => bandOf(r) ?? 0);
      return {
        mod,
        count: attempts.length,
        latest: bands[bands.length - 1],
        first: bands[0],
        avg: bands.reduce((a, b) => a + b, 0) / bands.length,
      };
    });
  }, [initialRecords]);

  // Filter, search, and sort records in memory
  const processedRecords = useMemo(() => {
    let list = [...initialRecords];

    // 1. Filter by Module
    if (selectedModule !== "All") {
      list = list.filter((r) => r.module === selectedModule);
    }

    // 2. Search by Title
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(query) || r.module.toLowerCase().includes(query));
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
        const valA = bandOf(a) ?? 0; // "Not graded" sorts as 0
        const valB = bandOf(b) ?? 0;
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

  const handleModuleChange = (module: Filter) => {
    setSelectedModule(module);
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as Sort);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedModule("All");
    setCurrentPage(1);
  };

  const marked = initialRecords.filter((r) => bandOf(r) != null);
  const earliest = marked.length ? marked[marked.length - 1].date : null;
  const title =
    initialRecords.length === 0
      ? "No results yet."
      : marked.length === 0
        ? `${initialRecords.length} ${initialRecords.length === 1 ? "attempt" : "attempts"}, none marked yet.`
        : `${marked.length} marked ${marked.length === 1 ? "attempt" : "attempts"} since ${dayMonth(earliest!).replace(" ", "\u00a0")}.`;

  const start = processedRecords.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, processedRecords.length);
  const bandSorted = sortBy === "highest" || sortBy === "lowest";
  const SortGlyph = sortBy === "newest" || sortBy === "highest" ? ArrowDown : ArrowUp;

  return (
    <AppShell title="Results">
      <PageColumn
        title={title}
        lead={
          initialRecords.length === 0
            ? "Every marked essay, speaking answer and test you finish is listed here with its band."
            : "Latest band per module, and every attempt behind it."
        }
        actions={
          initialRecords.length === 0 ? (
            <Button asChild variant="accent">
              <Link href="/writing">Start a practice</Link>
            </Button>
          ) : undefined
        }
      >
        {initialRecords.length > 0 && (
          <>
            {/* Latest band per module: one panel split by hairlines */}
            <section
              aria-label="Latest band per module"
              className="grid grid-cols-2 overflow-hidden rounded-2xl bg-panel lg:grid-cols-4"
            >
              {moduleSummary.map((m, i) => (
                <div
                  key={m.mod}
                  className={cn(
                    "flex flex-col gap-2 p-4 sm:p-5",
                    i % 2 === 1 && "border-l border-border",
                    i >= 2 && "border-t border-border lg:border-t-0",
                    i === 2 && "lg:border-l"
                  )}
                >
                  <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
                    <span aria-hidden className={cn("size-2 rounded-full", MODULE_HUE[m.mod])} />
                    {m.mod}
                  </span>
                  <span className="tabular font-display text-[36px] text-ink">
                    {m.latest != null ? m.latest.toFixed(1) : "—"}
                  </span>
                  <span className="text-sm text-soft">
                    {m.count === 0
                      ? "No attempts yet"
                      : m.count === 1
                        ? "1 marked attempt"
                        : `From ${m.first!.toFixed(1)} · average ${m.avg!.toFixed(1)}`}
                  </span>
                </div>
              ))}
            </section>

            {/* Toolbar */}
            <div className="mt-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SegmentedControl
                label="Filter by module"
                value={selectedModule}
                onChange={handleModuleChange}
                options={[{ value: "All", label: "All" }, ...MODULES.map((m) => ({ value: m, label: m }))]}
              />
              <div className="flex gap-2">
                <label className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
                  <span className="sr-only">Search results</span>
                  <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-soft" />
                  <Input
                    type="search"
                    placeholder="Search by task or test"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="pl-9"
                  />
                </label>
                <label className="shrink-0">
                  <span className="sr-only">Sort</span>
                  <select
                    value={sortBy}
                    onChange={handleSortChange}
                    className="h-10 cursor-pointer rounded-[10px] border border-input bg-sheet px-3 text-[15px] text-ink transition-[border-color] duration-[var(--duration-quick)] outline-none hover:border-line-strong focus-visible:border-brand"
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <p className="mt-6 text-sm text-soft" aria-live="polite">
              {processedRecords.length === initialRecords.length
                ? `${initialRecords.length} ${initialRecords.length === 1 ? "attempt" : "attempts"}`
                : `${processedRecords.length} of ${initialRecords.length} attempts`}
            </p>

            {processedRecords.length === 0 ? (
              <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl bg-panel p-6">
                <p className="text-[15px] text-ink">
                  No {selectedModule === "All" ? "" : `${selectedModule} `}results
                  {searchQuery.trim() ? <> match &ldquo;{searchQuery.trim()}&rdquo;</> : " yet"}.
                </p>
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop and tablet: a real table */}
                <table className="mt-2 hidden w-full border-collapse text-[15px] md:table">
                  <thead>
                    <tr className="border-b border-border text-left text-sm text-soft">
                      <th scope="col" className="h-10 w-[120px] pr-4 font-normal">
                        <span className="inline-flex items-center gap-1">
                          Date
                          {!bandSorted && <SortGlyph aria-hidden className="size-3.5" />}
                        </span>
                      </th>
                      <th scope="col" className="h-10 w-[120px] pr-4 font-normal">Module</th>
                      <th scope="col" className="h-10 pr-4 font-normal">Task</th>
                      <th scope="col" className="h-10 w-[110px] pr-4 text-right font-normal">Raw score</th>
                      <th scope="col" className="h-10 w-[80px] text-right font-normal">
                        <span className="inline-flex items-center gap-1">
                          {bandSorted && <SortGlyph aria-hidden className="size-3.5" />}
                          Band
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((record) => (
                      <tr
                        key={`${record.module}-${record.id}`}
                        className="group border-b border-border transition-colors duration-[var(--duration-quick)] hover:bg-panel"
                      >
                        <td className="tabular h-12 pr-4 text-soft">{fullDate(record.date)}</td>
                        <td className="h-12 pr-4 text-soft">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden className={cn("size-1.5 rounded-full", MODULE_HUE[record.module])} />
                            {record.module}
                          </span>
                        </td>
                        <td className="h-12 pr-4">
                          <Link
                            href={attemptHref(record)}
                            className="text-ink underline-offset-4 group-hover:underline focus-visible:underline focus-visible:outline-none"
                          >
                            {record.title}
                          </Link>
                        </td>
                        <td className="tabular h-12 pr-4 text-right text-soft">{record.rawScore ?? "—"}</td>
                        <td className="tabular h-12 text-right text-[17px] text-ink">{formatBand(record)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Phone: two-line rows, the band on the right edge */}
                <ul className="mt-2 border-t border-border md:hidden">
                  {paginatedRecords.map((record) => (
                    <li key={`${record.module}-${record.id}`} className="border-b border-border">
                      <Link href={attemptHref(record)} className="flex min-h-[60px] items-center justify-between gap-4 py-2.5 active:bg-panel">
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] text-ink">{record.title}</span>
                          <span className="block text-sm text-soft">
                            {record.module} · {fullDate(record.date)}
                            {record.rawScore ? ` · ${record.rawScore}` : ""}
                          </span>
                        </span>
                        <span className="tabular shrink-0 text-[17px] text-ink">{formatBand(record)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Paging, with the range stated */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="tabular text-sm text-soft">
                  {start}–{end} of {processedRecords.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </PageColumn>
    </AppShell>
  );
}
