"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  isCreating: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/**
 * The conversation list, on the white sheet beside the thread (not a second dark sidebar). On a
 * phone it slides over the thread from the left and closes once a conversation is picked.
 */
export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  isOpen,
  onToggleOpen,
  isCreating,
  isLoading,
  isError,
  onRetry,
}: ChatSidebarProps) {
  return (
    <aside
      aria-label="Conversations"
      data-open={isOpen}
      className={cn(
        "flex w-full flex-col bg-sheet",
        // phone: an overlay sheet that slides in over the thread
        "fixed inset-x-0 top-12 bottom-0 z-20 transition-[opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] data-[open=false]:pointer-events-none data-[open=false]:-translate-x-3 data-[open=false]:opacity-0 motion-reduce:transition-none",
        // desktop: a fixed column inside the sheet, split from the thread by one rule
        "lg:static lg:z-auto lg:w-[264px] lg:shrink-0 lg:translate-x-0 lg:border-r lg:border-border lg:opacity-100 lg:transition-none lg:data-[open=false]:pointer-events-auto lg:data-[open=false]:translate-x-0 lg:data-[open=false]:opacity-100"
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 lg:px-5">
        <h2 className="text-[15px] font-semibold text-ink">Conversations</h2>
        <Button onClick={onCreateSession} disabled={isCreating} variant="secondary" size="sm">
          <Plus />
          New
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-4 lg:px-3">
        {isLoading ? (
          <ul className="flex flex-col gap-1 px-2 pt-1" aria-busy>
            {[0, 1, 2].map((i) => (
              <li key={i} className="py-2">
                <div className="t-skel h-4 w-4/5" />
                <div className="t-skel mt-2 h-3 w-1/4" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <div className="px-3 pt-2 text-[15px] leading-relaxed">
            <p className="text-ink">Your conversations did not load.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 text-sm text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              Try again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-3 pt-2 text-[15px] leading-relaxed text-soft">
            No conversations yet. Your first question starts one.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => {
                      onSelectSession(session.id);
                      // On mobile, close sidebar after selecting session
                      if (isOpen && window.innerWidth < 1024) {
                        onToggleOpen();
                      }
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-baseline justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-[var(--duration-quick)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                      isActive ? "bg-panel-strong" : "hover:bg-panel"
                    )}
                  >
                    <span className={cn("truncate text-[15px] text-ink", isActive && "font-medium")}>
                      {session.title || "Untitled conversation"}
                    </span>
                    <span className="tabular shrink-0 text-[13px] text-soft">{shortDate(session.updated_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
