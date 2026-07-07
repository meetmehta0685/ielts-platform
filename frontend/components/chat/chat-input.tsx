"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Mic, Square } from "lucide-react";
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
}

export function ChatInput({
  onSendMessage,
  isDisabled,
  isStreaming,
  activeSessionId,
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
    if (!input.trim() || isDisabled) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeSessionId) return null;

  return (
    <div className="border-t border-muted/50 bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto flex items-end gap-3 bg-muted/30 border border-muted/50 rounded-2xl p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Recording speech active..." : "Ask your IELTS Mentor a question..."}
          rows={1}
          disabled={isDisabled || isRecording}
          className="flex-1 min-h-[40px] max-h-[200px] border-0 bg-transparent px-3 py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none animate-none"
        />

        {/* Microphone voice input button */}
        <Button
          type="button"
          onClick={toggleRecording}
          disabled={isDisabled || isTranscribing}
          variant={isRecording ? "destructive" : "ghost"}
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl shrink-0 transition-all text-muted-foreground hover:text-foreground",
            isRecording && "bg-rose-500 hover:bg-rose-600 text-white animate-pulse"
          )}
        >
          {isTranscribing ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : isRecording ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Mic className="h-4.5 w-4.5" />
          )}
        </Button>

        <Button
          type="button"
          onClick={handleSend}
          disabled={isDisabled || !input.trim() || isRecording}
          size="icon"
          className="h-9 w-9 rounded-xl shrink-0"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="max-w-3xl mx-auto text-[10px] text-muted-foreground text-center mt-2.5">
        AI responses are designed to support your IELTS studies. Always review detailed scoring guides.
      </p>
    </div>
  );
}
