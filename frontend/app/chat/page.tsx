"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
  const { data: sessions = EMPTY_SESSIONS, isLoading: isLoadingSessions } = useQuery<ChatSession[]>({
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

  // Auto-create chat session if redirecting from dashboard module
  useEffect(() => {
    if (userId && token && moduleParam && !isLoadingSessions && !hasTriggeredAutoSession) {
      setHasTriggeredAutoSession(true);
      createSessionMutation.mutate();
    }
  }, [userId, token, moduleParam, isLoadingSessions, hasTriggeredAutoSession]);

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
  useEffect(() => {
    if (serverMessages) {
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
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to start new chat.");
    },
  });

  // 5. Stream message response using ReadableStream and Server-Sent Events (SSE)
  const handleSendMessage = async (content: string, customSessionId?: string) => {
    const sessionId = customSessionId || activeSessionId;
    if (!sessionId || !token || isStreaming) return;

    // Append user's message locally immediately for instant feedback
    const userMessage: Message = { role: "user", content };
    setLocalMessages((prev) => [...prev, userMessage]);
    
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: sessionId, message: content }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to communicate with AI Mentor");
      }

      // Read the SSE chunks live
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const dataStr = line.slice(6);
              const data = JSON.parse(dataStr);
              if (data.token) {
                accumulated += data.token;
                setStreamingMessage(accumulated);
              } else if (data.error) {
                toast.error(data.error);
              }
            } catch (err) {
              // Ignore partial JSON parsing errors on chunk splits
            }
          }
        }
      }

      // Finish streaming, sync final response to local list
      const assistantMessage: Message = { role: "assistant", content: accumulated };
      setLocalMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessage("");

      // Invalidate queries to refresh background persistence
      queryClient.invalidateQueries({ queryKey: ["chat-messages", activeSessionId, token] });
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", userId, token] });

    } catch (err: any) {
      toast.error(err.message || "Something went wrong during message streaming.");
    } finally {
      setIsStreaming(false);
    }
  };

  if (isAuthVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Sessions history */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={() => createSessionMutation.mutate()}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen((prev) => !prev)}
        isCreating={createSessionMutation.isPending}
      />

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-muted/50 px-6 md:px-8 bg-background/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4 pl-12 md:pl-0">
            <h1 className="text-sm font-extrabold text-foreground tracking-tight">IELTS AI Mentor</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Trainer
            </span>
          </div>
          <a
            href="/dashboard"
            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
          >
            Back to Dashboard
          </a>
        </header>

        {/* Messages display area */}
        <ChatArea
          messages={localMessages}
          isLoading={isLoadingMessages}
          streamingMessage={streamingMessage}
          activeSessionId={activeSessionId}
          onStarterClick={handleSendMessage}
        />

        {/* Message Input box */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isDisabled={isStreaming}
          isStreaming={isStreaming}
          activeSessionId={activeSessionId}
        />
      </div>
    </div>
  );
}
