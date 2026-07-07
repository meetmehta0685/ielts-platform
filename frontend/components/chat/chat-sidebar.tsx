"use client";

import { MessageSquare, Plus, Menu, X, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  isOpen,
  onToggleOpen,
  isCreating,
}: ChatSidebarProps) {
  return (
    <>
      {/* Mobile Menu Trigger */}
      <div className="absolute top-4 left-4 z-20 md:hidden">
        <Button variant="outline" size="icon" onClick={onToggleOpen} className="h-9 w-9 bg-background/90 shadow-sm">
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-10 flex w-72 flex-col border-r border-muted/50 bg-muted/20 transition-transform duration-300 md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-muted/50 px-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-foreground tracking-tight block leading-none">IELTS Prep</span>
              <span className="text-[10px] text-muted-foreground font-bold">AI Mentor Chat</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onToggleOpen}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Action Button */}
        <div className="p-4 shrink-0">
          <Button
            onClick={onCreateSession}
            disabled={isCreating}
            className="w-full justify-start gap-2 h-10 shadow-sm text-sm font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground transition-all duration-200 hover:shadow-md hover:shadow-primary/5 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>
        </div>

        {/* Sessions Scrollable History */}
        <ScrollArea className="flex-1 px-3 pb-4">
          <div className="space-y-1">
            <h2 className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Recent Chats
            </h2>
            {sessions.length === 0 ? (
              <p className="px-3 py-6 text-xs text-muted-foreground text-center bg-muted/5 rounded-xl border border-dashed border-muted/50 my-2">
                No conversation history.
              </p>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSelectSession(session.id);
                      // On mobile, close sidebar after selecting session
                      if (window.innerWidth < 768) {
                        onToggleOpen();
                      }
                    }}
                    className={cn(
                      "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all select-none hover:bg-muted/70",
                      isActive
                        ? "bg-primary/8 text-primary shadow-xs border border-primary/10"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate pr-2">{session.title}</span>
                    </div>
                    {isActive && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </aside>


      {/* Backdrop for mobile overlays */}
      {isOpen && (
        <div
          onClick={onToggleOpen}
          className="fixed inset-0 z-5 bg-background/50 backdrop-blur-xs md:hidden"
        />
      )}
    </>
  );
}
