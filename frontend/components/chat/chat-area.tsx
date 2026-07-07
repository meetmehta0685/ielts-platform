"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, User, HelpCircle, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  streamingMessage: string;
  activeSessionId: string | null;
  onStarterClick?: (text: string) => void;
}

const MarkdownComponents = {
  h1: ({ node, ...props }: any) => <h1 className="text-base font-extrabold mt-3 mb-1.5 text-foreground" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-sm font-bold mt-2.5 mb-1 text-foreground" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-xs font-bold mt-2 mb-1 text-foreground" {...props} />,
  p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0 text-sm leading-relaxed" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 mb-2 space-y-1 text-sm text-foreground/90" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-sm text-foreground/90" {...props} />,
  li: ({ node, ...props }: any) => <li className="mb-0.5 text-sm leading-relaxed" {...props} />,
  code: ({ node, className, children, ...props }: any) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-muted/80 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold text-foreground border border-muted" {...props}>{children}</code>
    ) : (
      <pre className="bg-muted/50 p-3 rounded-xl overflow-x-auto my-2 border border-muted/50"><code className="text-xs font-mono text-foreground" {...props}>{children}</code></pre>
    );
  },
  table: ({ node, ...props }: any) => <div className="overflow-x-auto my-3 border border-muted/50 rounded-xl"><table className="min-w-full divide-y divide-muted/50 text-xs" {...props} /></div>,
  thead: ({ node, ...props }: any) => <thead className="bg-muted/50" {...props} />,
  tbody: ({ node, ...props }: any) => <tbody className="divide-y divide-muted/30" {...props} />,
  tr: ({ node, ...props }: any) => <tr {...props} />,
  th: ({ node, ...props }: any) => <th className="px-3 py-2 text-left font-semibold text-muted-foreground" {...props} />,
  td: ({ node, ...props }: any) => <td className="px-3 py-2 text-foreground" {...props} />,
  blockquote: ({ node, ...props }: any) => <blockquote className="border-l-2 border-primary/50 pl-3 italic my-2 text-muted-foreground/80" {...props} />,
};

export function ChatArea({
  messages,
  isLoading,
  streamingMessage,
  activeSessionId,
  onStarterClick,
}: ChatAreaProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Read the AI Mentor message out loud in a natural English voice
  const speakMessage = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      return;
    }

    // Strip markdown symbols for clean voice generation
    const cleanText = text
      .replace(/[\#\*\_\[\]\(\)\-\`\>]/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith("en-") && v.name.includes("Google")) ||
                         voices.find(v => v.lang.startsWith("en-"));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll to the bottom when messages or the active stream changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      const scrollContainer = scrollContainerRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, streamingMessage]);

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
        {/* Glow element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-primary/5 blur-[80px] pointer-events-none" />
        
        <div className="max-w-md w-full text-center space-y-6 relative z-10 animate-message-appear">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20">
            <Sparkles className="h-10 w-10 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground bg-clip-text">
              IELTS AI Mentor
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Unlock your true scoring potential. Select an existing conversation or start a new practice session now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const starters = [
    { module: "Writing", desc: "How to structure an opinion essay", prompt: "How do I structure a band 8 IELTS Writing Task 2 opinion essay?" },
    { module: "Reading", desc: "Skimming vs scanning strategies", prompt: "Explain the best skimming and scanning strategies for IELTS Reading passages." },
    { module: "Listening", desc: "Avoid spelling trap questions", prompt: "What are the common spelling and formatting traps in the IELTS Listening module?" },
    { module: "Speaking", desc: "Band 9 tips for Cue Card", prompt: "Could you give me a speaking Cue Card topic with a structure for a band 9 response?" },
  ];

  return (
    <ScrollArea ref={scrollContainerRef} className="flex-1 px-4 py-6 md:px-8 bg-background relative">
      <div className="max-w-3xl mx-auto space-y-6 pb-6">
        {/* Render existing messages or empty state */}
        {messages.length === 0 && !isLoading && !streamingMessage ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-8 animate-message-appear">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/10 to-primary/5 text-primary border border-primary/20 shadow-xs">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Hi! I'm your IELTS AI Mentor.</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Get instant feedback aligned with IELTS band descriptors. Click any starter below or ask a custom question:
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl w-full text-left">
              {starters.map((item) => (
                <button
                  key={item.module}
                  onClick={() => onStarterClick?.(item.prompt)}
                  className="group rounded-2xl border border-muted/60 p-4 bg-muted/10 text-left transition-all duration-300 hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5 cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-primary group-hover:text-primary/90 transition-colors">
                      {item.module} Prep
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground border border-muted px-1.5 py-0.5 rounded-md group-hover:border-primary/20 group-hover:text-primary transition-all">
                      Try
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed group-hover:text-foreground/80 transition-colors">
                    {item.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id || index}
                  className={cn(
                    "flex items-start gap-3.5 animate-message-appear",
                    isUser ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {/* Avatar Bubble */}
                  <Avatar className={cn("h-9 w-9 border shrink-0 shadow-xs", isUser ? "border-primary/20" : "border-muted/50")}>
                    <AvatarFallback className={isUser ? "bg-primary text-primary-foreground text-xs font-bold" : "bg-muted"}>
                      {isUser ? <User className="h-4.5 w-4.5" /> : <Sparkles className="h-4.5 w-4.5 text-primary" />}
                    </AvatarFallback>
                  </Avatar>

                  {/* Message Bubble content container */}
                  <div className="flex flex-col items-start gap-1 max-w-[82%]">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm shadow-xs leading-relaxed w-full",
                        isUser
                          ? "bg-gradient-to-r from-primary to-primary/95 text-primary-foreground rounded-tr-none"
                          : "bg-muted/30 text-foreground border border-muted/40 rounded-tl-none prose prose-neutral dark:prose-invert max-w-none"
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                          {message.content}
                        </ReactMarkdown>
                      )}
                    </div>
                    
                    {!isUser && (
                      <button
                        onClick={() => speakMessage(message.content)}
                        className="text-[10px] font-bold text-muted-foreground hover:text-primary flex items-center gap-1 mt-1 ml-1 cursor-pointer transition-colors bg-transparent border-0 p-0"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        Listen to feedback
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Render loading skeletons */}
            {isLoading && (
              <div className="flex items-start gap-3.5 animate-message-appear">
                <Avatar className="h-9 w-9 border shrink-0 shadow-xs border-muted/50">
                  <AvatarFallback className="bg-muted">
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted/30 rounded-2xl rounded-tl-none border border-muted/40 p-4 w-[75%] space-y-3 animate-pulse shadow-xs">
                  <div className="h-3.5 bg-muted/80 rounded-md w-3/4" />
                  <div className="h-3.5 bg-muted/80 rounded-md w-5/6" />
                  <div className="h-3.5 bg-muted/80 rounded-md w-1/2" />
                </div>
              </div>
            )}

            {/* Render active streaming message (assistant response) */}
            {streamingMessage && (
              <div className="flex items-start gap-3.5 animate-message-appear">
                <Avatar className="h-9 w-9 border shrink-0 shadow-xs border-muted/50">
                  <AvatarFallback className="bg-muted">
                    <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted/30 text-foreground border border-muted/40 rounded-2xl rounded-tl-none px-4 py-3 text-sm max-w-[82%] shadow-xs prose prose-neutral dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                    {streamingMessage}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

