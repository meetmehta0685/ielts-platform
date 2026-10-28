"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef, type JSX } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Volume2 } from "lucide-react";
import { toast } from "sonner";
import { ThinkingStatus } from "@/components/writing/thinking-status";

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
  isStreaming?: boolean;
  firstName?: string | null;
  error?: string | null;
  onRetry?: () => void;
}

/** Real questions candidates bring to a tutor, one per skill plus two of the classic confusions. */
const STARTERS = [
  { module: "Writing", prompt: "How do I structure a band 8 IELTS Writing Task 2 opinion essay?" },
  { module: "Reading", prompt: "What is the difference between False and Not given in True / False / Not given questions?" },
  { module: "Speaking", prompt: "Could you give me a speaking Cue Card topic with a structure for a band 9 response?" },
  { module: "Listening", prompt: "What are the common spelling and formatting traps in the IELTS Listening module?" },
  { module: "Writing", prompt: "What belongs in a Task 1 overview, and where should it go?" },
  { module: "Reading", prompt: "Explain the best skimming and scanning strategies for IELTS Reading passages." },
];

const THINKING = ["Thinking", "Checking the band descriptors", "Drafting an answer"];

/* ---------- Streaming words: each new word resolves through a soft blur (recipe 30) ---------- */

const STREAM_WORD_CLASS = "animate-[t-stream-in_var(--duration-slow)_var(--ease-in-out)_both] motion-reduce:animate-none";

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Rehype plugin: wraps every word of prose in a span so newly streamed words fade in. */
function rehypeStreamWords() {
  const walk = (node: HastNode, inCode: boolean) => {
    if (!node.children) return;
    const next: HastNode[] = [];
    for (const child of node.children) {
      if (child.type === "text" && !inCode && child.value) {
        for (const part of child.value.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) next.push({ type: "text", value: part });
          else
            next.push({
              type: "element",
              tagName: "span",
              properties: { className: [STREAM_WORD_CLASS] },
              children: [{ type: "text", value: part }],
            });
        }
      } else {
        walk(child, inCode || child.tagName === "code" || child.tagName === "pre");
        next.push(child);
      }
    }
    node.children = next;
  };
  return (tree: HastNode) => walk(tree, false);
}

/* ---------- Markdown set for reading at 16px on the sheet ---------- */

type P<T extends keyof JSX.IntrinsicElements> = ComponentPropsWithoutRef<T> & { node?: unknown };

/** Drops react-markdown's `node` prop so it never reaches the DOM. */
function clean<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const { node, ...rest } = props;
  void node;
  return rest;
}

const MarkdownComponents: Components = {
  h1: (props: P<"h3">) => <h3 className="mt-6 mb-2 text-[17px] font-semibold text-ink first:mt-0" {...clean(props)} />,
  h2: (props: P<"h3">) => <h3 className="mt-6 mb-2 text-[17px] font-semibold text-ink first:mt-0" {...clean(props)} />,
  h3: (props: P<"h4">) => <h4 className="mt-5 mb-1.5 text-base font-semibold text-ink first:mt-0" {...clean(props)} />,
  p: (props: P<"p">) => <p className="mb-4 last:mb-0" {...clean(props)} />,
  strong: (props: P<"strong">) => <strong className="font-semibold text-ink" {...clean(props)} />,
  ul: (props: P<"ul">) => <ul className="mb-4 flex list-disc flex-col gap-1.5 pl-5 marker:text-soft last:mb-0" {...clean(props)} />,
  ol: (props: P<"ol">) => <ol className="mb-4 flex list-decimal flex-col gap-1.5 pl-5 marker:text-soft last:mb-0" {...clean(props)} />,
  li: (props: P<"li">) => <li className="pl-1" {...clean(props)} />,
  a: (props: P<"a">) => <a className="underline decoration-1 underline-offset-4 hover:decoration-2" target="_blank" rel="noreferrer" {...clean(props)} />,
  code: (all: P<"code">) => {
    const { className, children, ...props } = all;
    const isInline = !className;
    return isInline ? (
      <code className="rounded-[5px] bg-panel-strong px-1.5 py-0.5 text-[0.94em]" {...clean(props)}>
        {children}
      </code>
    ) : (
      <code className={className} {...clean(props)}>
        {children}
      </code>
    );
  },
  pre: (props: P<"pre">) => (
    <pre className="my-4 overflow-x-auto rounded-xl bg-panel p-4 text-[15px] leading-relaxed whitespace-pre-wrap" {...clean(props)} />
  ),
  table: (props: P<"table">) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[15px]" {...clean(props)} />
    </div>
  ),
  th: (props: P<"th">) => <th className="border-b border-border py-2 pr-4 text-sm font-normal text-soft" {...clean(props)} />,
  td: (props: P<"td">) => <td className="border-b border-border py-2 pr-4 align-top" {...clean(props)} />,
  blockquote: (props: P<"blockquote">) => (
    <blockquote className="my-4 border-l-2 border-line-strong pl-4 text-soft" {...clean(props)} />
  ),
  hr: () => <hr className="my-6 border-border" />,
};

export function ChatArea({
  messages,
  isLoading,
  streamingMessage,
  activeSessionId,
  onStarterClick,
  isStreaming,
  firstName,
  error,
  onRetry,
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
      .replace(/[#*_[\]()\-`>]/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice =
      voices.find((v) => v.lang.startsWith("en-") && v.name.includes("Google")) ||
      voices.find((v) => v.lang.startsWith("en-"));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll to the bottom when messages or the active stream changes
  const isEmpty = !isStreaming && messages.length === 0 && (!activeSessionId || (!isLoading && !streamingMessage));

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && !isEmpty) el.scrollTop = el.scrollHeight;
  }, [messages, streamingMessage, isStreaming, error, isEmpty]);

  if (isEmpty) {
    return (
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-4 pt-10 pb-8 sm:px-6 lg:pt-[72px]">
          <h1 className="font-display text-[32px] text-balance text-ink sm:text-[44px]">
            {firstName ? `What's your question, ${firstName}?` : "What's your question?"}
          </h1>
          <p className="mt-3 text-[17px] leading-normal text-soft">
            Ask about a band descriptor, a Task 2 plan, a cue card or one tricky sentence.
          </p>
          <ul className="mt-10 flex flex-col border-t border-border">
            {STARTERS.map((item, i) => (
              <li key={item.prompt} className="t-rise border-b border-border" style={{ animationDelay: `${i * 40}ms` }}>
                <button
                  type="button"
                  onClick={() => onStarterClick?.(item.prompt)}
                  className="group flex min-h-12 w-full items-baseline justify-between gap-6 py-3.5 text-left transition-colors duration-[var(--duration-quick)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="text-base leading-snug text-ink decoration-1 underline-offset-4 group-hover:underline">
                    {item.prompt}
                  </span>
                  <span className="shrink-0 text-sm text-soft">{item.module}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 pt-8 pb-10 sm:px-6">
        {messages.map((message, index) => {
          const isUser = message.role === "user";
          return isUser ? (
            <div key={message.id || index} className="t-rise flex justify-end">
              <p className="max-w-[85%] rounded-2xl bg-panel-strong px-4 py-2.5 text-base leading-relaxed whitespace-pre-wrap text-ink sm:max-w-[75%]">
                {message.content}
              </p>
            </div>
          ) : (
            <div key={message.id || index} className="t-rise">
              <div className="text-base leading-[1.7] text-ink">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>
              <button
                type="button"
                onClick={() => speakMessage(message.content)}
                className="-ml-2 mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[13px] text-soft transition-colors duration-[var(--duration-quick)] hover:bg-panel hover:text-ink"
              >
                <Volume2 className="size-3.5" />
                Listen
              </button>
            </div>
          );
        })}

        {/* Loading the thread */}
        {isLoading && (
          <div className="flex flex-col gap-8" aria-busy>
            <div className="flex justify-end">
              <div className="t-skel h-10 w-1/2 rounded-2xl" />
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="t-skel h-4 w-full" />
              <div className="t-skel h-4 w-11/12" />
              <div className="t-skel h-4 w-3/5" />
            </div>
          </div>
        )}

        {/* Before the first token */}
        {isStreaming && !streamingMessage && (
          <div className="t-rise text-base">
            <ThinkingStatus states={THINKING} />
          </div>
        )}

        {/* The answer as it streams in */}
        {streamingMessage && (
          <div className="text-base leading-[1.7] text-ink" aria-live="polite">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeStreamWords]} components={MarkdownComponents}>
              {streamingMessage}
            </ReactMarkdown>
          </div>
        )}

        {error && !isStreaming && (
          <div role="alert" className="t-rise rounded-2xl bg-bad-tint p-4 text-[15px] leading-relaxed">
            <p className="font-medium text-bad">The mentor did not answer.</p>
            <p className="mt-1 text-ink">{error} The free model may be busy; wait a moment and ask again.</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-sm font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                Ask again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
