"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { readSseEvents } from "@/lib/sse";
import { PanelLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";

import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { ChatInput } from "@/components/chat/chat-input";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

const EMPTY_MESSAGES: Message[] = [];
const EMPTY_SESSIONS: ChatSession[] = [];

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthVerifying, setIsAuthVerifying] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);

  // A question asked before any conversation exists: held here until the new session is created.
  const pendingPromptRef = useRef<string | null>(null);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const isStreamingRef = useRef(false);
  const [chatError, setChatError] = useState<{ message: string; content: string; sessionId: string } | null>(null);

  // Auto-initiate module states
  const [moduleParam, setModuleParam] = useState<string | null>(null);
  const [hasTriggeredAutoSession, setHasTriggeredAutoSession] = useState(false);

  // Streaming states
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  // Parse parameters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mod = params.get("module");
      if (mod) {
        setModuleParam(mod);
      }
    }
  }, []);

  // 1. Authenticate user client-side and extract the JWT token
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          toast.error("You must be logged in to access the AI Mentor Chat.");
          router.push("/auth/login?redirect=/chat");
          return;
        }

        setToken(session.access_token);

        if (session.user) {
          setUserId(session.user.id);
          const full = (session.user.user_metadata?.full_name as string | undefined)?.trim();
          setFirstName(full ? full.split(/\s+/)[0] : null);
        } else {
          // If session.user is stripped from the cookie storage, fetch details using getUser()
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) {
            toast.error("Session verification failed. Please login again.");
            router.push("/auth/login?redirect=/chat");
          } else {
            setUserId(user.id);
          }
        }
      } catch (err) {
        console.error("Session verification failed:", err);
        router.push("/auth/login?redirect=/chat");
      } finally {
        setIsAuthVerifying(false);
      }
    };
    fetchSession();
  }, [router]);

  // 2. Fetch all chat sessions for the user using TanStack Query
  const {
    data: sessions = EMPTY_SESSIONS,
    isLoading: isLoadingSessions,
    isError: isSessionsError,
    refetch: refetchSessions,
  } = useQuery<ChatSession[]>({
    queryKey: ["chat-sessions", userId, token],
    queryFn: async () => {
      if (!userId || !token) return [];
      const res = await fetch(`${BACKEND_URL}/api/chat/sessions/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    enabled: !!userId && !!token,
  });

  // 3. Fetch all messages in the active session
  const { data: serverMessages = EMPTY_MESSAGES, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ["chat-messages", activeSessionId, token],
    queryFn: async () => {
      if (!activeSessionId || !token) return [];
      const res = await fetch(`${BACKEND_URL}/api/chat/messages/${activeSessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!activeSessionId && !!token,
  });

  // Sync server-fetched messages with local display messages
  // (skipped mid-stream, so a refetch of a brand-new session cannot wipe the question just sent)
  useEffect(() => {
    if (serverMessages && !isStreamingRef.current) {
      setLocalMessages(serverMessages);
    }
  }, [serverMessages]);

  // 4. Create new chat session mutation
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !token) throw new Error("Authentication information missing");
      const res = await fetch(`${BACKEND_URL}/api/chat/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) throw new Error("Failed to create new session");
      return res.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", userId, token] });
      setActiveSessionId(newSession.session_id);
      setLocalMessages([]);
      toast.success("New conversation started!");

      // If module parameter is present, send the initial query immediately
      if (moduleParam) {
        const starterPrompts: Record<string, string> = {
          writing: "How do I structure a band 8 IELTS Writing Task 2 opinion essay?",
          reading: "Explain the best skimming and scanning strategies for IELTS Reading passages.",
          listening: "What are the common spelling and formatting traps in the IELTS Listening module?",
          speaking: "Could you give me a speaking Cue Card topic with a structure for a band 9 response?"
        };
        const prompt = starterPrompts[moduleParam.toLowerCase()];
        if (prompt) {
          setTimeout(() => {
            handleSendMessage(prompt, newSession.session_id);
          }, 100);
        }

        // Clean query parameter in the browser url
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/chat");
        }
        setModuleParam(null);
      } else if (pendingPromptRef.current) {
        // A question typed (or a starter picked) before a conversation existed
        const pending = pendingPromptRef.current;
        pendingPromptRef.current = null;
        setTimeout(() => {
          handleSendMessage(pending, newSession.session_id);
        }, 100);
      }
    },
    onError: (err: any) => {
      pendingPromptRef.current = null;
      setPendingAsk(null);
      toast.error(err.message || "Failed to start new chat.");
    },
  });

  // Auto-create chat session if redirecting from dashboard module
  useEffect(() => {
    if (userId && token && moduleParam && !isLoadingSessions && !hasTriggeredAutoSession) {
      setHasTriggeredAutoSession(true);
      createSessionMutation.mutate();
    }
  }, [userId, token, moduleParam, isLoadingSessions, hasTriggeredAutoSession]);

  // 5. Stream message response using ReadableStream and Server-Sent Events (SSE)
  const handleSendMessage = async (content: string, customSessionId?: string) => {
    const sessionId = customSessionId || activeSessionId;
    if (!sessionId || !token || isStreaming) return;

    // Append user's message locally immediately for instant feedback
    const userMessage: Message = { role: "user", content };
    setLocalMessages((prev) => [...prev, userMessage]);
    setPendingAsk(null);

    isStreamingRef.current = true;
    setIsStreaming(true);
    setStreamingMessage("");
    setChatError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: sessionId, message: content }),
      });

      let accumulated = "";
      await readSseEvents<{ token?: string }>(response, (data) => {
        if (data.token) {
          accumulated += data.token;
          setStreamingMessage(accumulated);
        }
      });

      const assistantMessage: Message = { role: "assistant", content: accumulated };
      setLocalMessages((prev) => [...prev, assistantMessage]);

      queryClient.invalidateQueries({ queryKey: ["chat-messages", sessionId, token] });
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", userId, token] });

    } catch (err: any) {
      const message = err.message || "Something went wrong during message streaming.";
      setChatError({ message, content, sessionId });
      toast.error(message);
    } finally {
      setStreamingMessage("");
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  };

  // Ask from anywhere: with no conversation open, start one and send once it exists.
  const ask = (content: string) => {
    if (activeSessionId) {
      handleSendMessage(content);
      return;
    }
    if (createSessionMutation.isPending) return;
    pendingPromptRef.current = content;
    setPendingAsk(content);
    createSessionMutation.mutate();
  };

  // Re-send the question that failed, without leaving a duplicate bubble behind.
  const retryLast = () => {
    if (!chatError) return;
    const { content, sessionId } = chatError;
    setChatError(null);
    setLocalMessages((prev) =>
      prev.length && prev[prev.length - 1].role === "user" && prev[prev.length - 1].content === content
        ? prev.slice(0, -1)
        : prev
    );
    handleSendMessage(content, sessionId);
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const visibleError = chatError && chatError.sessionId === activeSessionId ? chatError.message : null;

  return (
    <AppShell title="Ask the mentor">
      <div className="flex h-[calc(100dvh-48px)] lg:h-[calc(100dvh-18px)]">
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onCreateSession={() => createSessionMutation.mutate()}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen((prev) => !prev)}
          isCreating={createSessionMutation.isPending}
          isLoading={isAuthVerifying || isLoadingSessions}
          isError={isSessionsError}
          onRetry={() => refetchSessions()}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border pr-4 pl-2 sm:pl-4 lg:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-expanded={sidebarOpen}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] px-3 text-[15px] text-ink transition-colors duration-[var(--duration-quick)] hover:bg-panel lg:hidden"
            >
              <PanelLeft className="size-4" />
              {sidebarOpen ? "Close" : "Conversations"}
            </button>
            <p key={activeSessionId ?? "new"} className="t-swap min-w-0 flex-1 truncate text-[15px] font-medium text-ink max-lg:text-right">
              {activeSession?.title || (activeSessionId ? "Conversation" : "New conversation")}
            </p>
          </header>

          <ChatArea
            messages={
              pendingAsk
                ? [...(activeSessionId ? localMessages : EMPTY_MESSAGES), { role: "user", content: pendingAsk }]
                : activeSessionId
                  ? localMessages
                  : EMPTY_MESSAGES
            }
            isLoading={!pendingAsk && (isAuthVerifying || isLoadingMessages)}
            streamingMessage={streamingMessage}
            activeSessionId={activeSessionId}
            onStarterClick={ask}
            isStreaming={isStreaming || !!pendingAsk}
            firstName={firstName}
            error={visibleError}
            onRetry={retryLast}
          />

          <ChatInput
            onSendMessage={ask}
            isDisabled={isStreaming}
            isStreaming={isStreaming}
            activeSessionId={activeSessionId}
            isBusy={isAuthVerifying || createSessionMutation.isPending}
          />
        </div>
      </div>
    </AppShell>
  );
}
