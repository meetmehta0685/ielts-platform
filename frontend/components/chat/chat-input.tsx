"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isDisabled: boolean;
  isStreaming: boolean;
  activeSessionId: string | null;
  /** Disables only the send button (e.g. while a conversation is being created). */
  isBusy?: boolean;
}

export function ChatInput({
  onSendMessage,
  isDisabled,
  isStreaming,
  activeSessionId,
  isBusy,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Start recording user's voice
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        handleTranscribe(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Recording started. Speak now!");
    } catch (err) {
      console.error("Microphone access failed:", err);
      toast.error("Could not access microphone. Verify browser permissions.");
    }
  };

  // Stop recording user's voice
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Transcribe recorded audio with backend Groq Whisper
  const handleTranscribe = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        toast.error("Session verification failed. Please login again.");
        return;
      }

      const formData = new FormData();
      formData.append("audio", blob, "speaking_chat.webm");

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/speaking/transcribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Speech recognition failed. Please try speaking again.");
      }

      const data = await response.json();
      if (data.transcript) {
        setInput((prev) => (prev ? prev + " " + data.transcript : data.transcript));
        toast.success("Voice transcribed!");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to transcribe audio.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Focus the textarea whenever the active session changes
  useEffect(() => {
    if (activeSessionId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeSessionId]);

  // Handle auto-resizing of the textarea based on the text length
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isDisabled || isBusy) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shrink-0 bg-sheet px-4 pt-2 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-end gap-2 rounded-[22px] border border-input bg-sheet p-2 pl-4 transition-[border-color] duration-[var(--duration-quick)] focus-within:border-brand">
          <label htmlFor="mentor-question" className="sr-only">
            Your question for the mentor
          </label>
          <Textarea
            id="mentor-question"
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening. Press stop when you finish." : "Ask about any part of the test"}
            rows={1}
            disabled={isDisabled || isRecording}
            className="max-h-[200px] min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-base leading-normal focus-visible:border-0"
          />

          {/* Microphone voice input button */}
          <Button
            type="button"
            onClick={toggleRecording}
            disabled={isDisabled || isTranscribing}
            variant={isRecording ? "default" : "ghost"}
            size="icon"
            aria-label={isTranscribing ? "Transcribing" : isRecording ? "Stop recording" : "Ask by voice"}
            className={cn("shrink-0", !isRecording && "text-soft hover:text-ink")}
          >
            {isTranscribing ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            ) : isRecording ? (
              <Square className="size-3.5 fill-current" />
            ) : (
              <Mic className="size-[18px]" />
            )}
          </Button>

          <Button
            type="button"
            onClick={handleSend}
            disabled={isDisabled || isBusy || !input.trim() || isRecording}
            variant="accent"
            size="icon"
            aria-label="Send"
            className="shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <ArrowUp className="size-[18px]" />
            )}
          </Button>
        </div>
        <p className="mt-2 hidden text-center text-[13px] text-soft sm:block">
          Enter to send, Shift and Enter for a new line. Check advice against the official band descriptors.
        </p>
      </div>
    </div>
  );
}
