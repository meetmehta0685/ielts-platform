"use client";

import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";
import { readSseEvents } from "@/lib/sse";
import { Loader2, Mic, Square, Volume2, ArrowLeft, CheckCircle, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SpeakingPartPrompt {
  part: number;
  title: string;
  question: string;
  description: string;
}

const SPEAKING_PARTS: SpeakingPartPrompt[] = [
  {
    part: 1,
    title: "Part 1: Interview & Warmup",
    question: "Let's talk about your hometown. Describe the town or city where you grew up. Is it a good place for young people to live, and why?",
    description: "You will answer basic personal questions about yourself, your family, or your home."
  },
  {
    part: 2,
    title: "Part 2: Individual Long Turn (Cue Card)",
    question: "Describe a piece of technology you own that is very important to you. You should say: what it is, when you got it, how you use it, and explain why it is so important to you.",
    description: "You have 1 minute to prepare notes. Then, you should speak for 1 to 2 minutes on this topic."
  },
  {
    part: 3,
    title: "Part 3: Two-Way Discussion",
    question: "In your opinion, how has modern technology changed the way families spend time together compared to the past? Do you believe these changes are positive or negative?",
    description: "You will answer more abstract, analytical questions developing the topic in Part 2."
  }
];

interface SpeakingResult {
  id?: string;
  band_score: number;
  fluency_coherence: number;
  lexical_resource: number;
  grammatical_range: number;
  pronunciation: number;
  examiner_comments: string;
  improvements: string[];
}

function SpeakingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Candidate Details
  const [candidateName, setCandidateName] = useState("Candidate");
  const [candidateId, setCandidateId] = useState("ielts-candidate");

  // CBT Configuration States
  const [fontScale, setFontScale] = useState<"sm" | "base" | "lg">("base");

  // Flow states
  const [currentPartIdx, setCurrentPartIdx] = useState(0);
  const currentPart = SPEAKING_PARTS[currentPartIdx];

  // Preparation & Recording states
  const [prepSeconds, setPrepSeconds] = useState(0);
  const [isPrepping, setIsPrepping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [notepadText, setNotepadText] = useState("");

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const prepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Candidate Webcam stream and ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Audio synthesis state
  const [isSpeakingPrompt, setIsSpeakingPrompt] = useState(false);

  // Pipeline result states
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [result, setResult] = useState<SpeakingResult | null>(null);

  // Sync session client-side
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          toast.error("Please login to access the Speaking Examiner.");
          router.push("/auth/login?redirect=/speaking");
        } else {
          setToken(session.access_token);
          if (session.user) {
            setCandidateName(session.user.email?.split("@")[0] || "Candidate");
            setCandidateId(`ielts-${session.user.id.substring(0, 8)}`);
          }
        }
      } catch (err) {
        console.error("Auth session fetch failed:", err);
      } finally {
        setIsAuthLoading(false);
      }
    };
    fetchSession();
  }, [router]);

  // Load past attempt if provided
  useEffect(() => {
    if (!token) return;

    const attemptId = searchParams.get("attempt_id");
    if (!attemptId) return;

    const fetchAttempt = async () => {
      try {
        const { data: attemptData, error: attemptErr } = await supabase
          .from("speaking_submissions")
          .select("*")
          .eq("id", attemptId)
          .single();

        if (attemptErr || !attemptData) {
          throw new Error(attemptErr?.message || "Attempt not found");
        }

        // Set speaking part
        const partIdx = SPEAKING_PARTS.findIndex(p => p.part === attemptData.part);
        if (partIdx !== -1) {
          setCurrentPartIdx(partIdx);
        }

        setTranscript(attemptData.transcript);
        setResult({
          id: attemptData.id,
          band_score: Number(attemptData.band_score),
          fluency_coherence: Number(attemptData.fluency_coherence),
          lexical_resource: Number(attemptData.lexical_resource),
          grammatical_range: Number(attemptData.grammatical_range),
          pronunciation: Number(attemptData.pronunciation),
          examiner_comments: attemptData.feedback_json?.examiner_comments || "",
          improvements: attemptData.feedback_json?.improvements || [],
        });
      } catch (err: unknown) {
        console.error("Failed to load speaking attempt:", err);
        toast.error("Failed to load speaking attempt details.");
      }
    };

    fetchAttempt();
  }, [token, searchParams]);

  // ElevenLabs custom HTML5 audio ref
  const elevenLabsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean timers and audio on unmount
  useEffect(() => {
    return () => {
      if (prepTimerRef.current) clearInterval(prepTimerRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (elevenLabsAudioRef.current) {
        elevenLabsAudioRef.current.pause();
      }
    };
  }, []);

  // Camera stream source setter
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Clean webcam on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const toggleCamera = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setCameraStream(stream);
      } catch (err) {
        console.error("[Webcam Access Error]:", err);
        toast.error("Failed to access camera. Please check camera permissions.");
      }
    }
  };

  // Fallback to browser-native TTS
  const playBrowserSpeech = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en-") && v.name.includes("Google")) ||
                        voices.find(v => v.lang.startsWith("en-"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    utterance.onstart = () => setIsSpeakingPrompt(true);
    utterance.onend = () => setIsSpeakingPrompt(false);
    utterance.onerror = () => setIsSpeakingPrompt(false);
    window.speechSynthesis.speak(utterance);
  };

  // Text to speech for examiner question
  const speakQuestion = async () => {
    // 1. Cancel browser-native voice if active
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // 2. Stop ElevenLabs audio if already playing
    if (elevenLabsAudioRef.current) {
      elevenLabsAudioRef.current.pause();
      elevenLabsAudioRef.current = null;
      setIsSpeakingPrompt(false);
      return; // Act as a toggle to pause
    }

    setIsSpeakingPrompt(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/speaking/synthesize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: currentPart.question,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed response from voice service");
      }

      const contentType = response.headers.get("Content-Type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.fallback) {
          console.log("[ElevenLabs Fallback] Key missing or disabled, using browser native.");
          playBrowserSpeech(currentPart.question);
          return;
        }
        throw new Error(data.error || "Synthesis response is JSON error");
      }

      // If it is binary audio, convert to blob url and play
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      elevenLabsAudioRef.current = audio;

      audio.onended = () => {
        elevenLabsAudioRef.current = null;
        setIsSpeakingPrompt(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = (e) => {
        console.error("[Audio Playback Error]", e);
        elevenLabsAudioRef.current = null;
        setIsSpeakingPrompt(false);
        URL.revokeObjectURL(audioUrl);
        // Fallback to browser synthesis
        playBrowserSpeech(currentPart.question);
      };
      
      await audio.play();
    } catch (error) {
      console.warn("[ElevenLabs API Error] falling back to browser voice:", error);
      elevenLabsAudioRef.current = null;
      playBrowserSpeech(currentPart.question);
    }
  };

  // Start Part 2 preparation timer
  const startPrepTimer = () => {
    setIsPrepping(true);
    setPrepSeconds(60);

    if (prepTimerRef.current) clearInterval(prepTimerRef.current);

    let remaining = 60;
    prepTimerRef.current = setInterval(() => {
      remaining -= 1;
      setPrepSeconds(remaining);
      if (remaining <= 0) {
        if (prepTimerRef.current) clearInterval(prepTimerRef.current);
        setIsPrepping(false);
        startRecording(); // Auto start recording when prep ends
      }
    }, 1000);
  };

  // Start recording microphone
  const startRecording = async () => {
    if (isPrepping) {
      if (prepTimerRef.current) clearInterval(prepTimerRef.current);
      setIsPrepping(false);
    }

    setTranscript("");
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        handleTranscribe(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      const limit = currentPart.part === 2 ? 120 : 60;
      let elapsed = 0;
      recordTimerRef.current = setInterval(() => {
        elapsed += 1;
        setRecordingSeconds(elapsed);
        if (elapsed >= limit) stopRecording();
      }, 1000);

      toast.success("Recording started. Speak now!");
    } catch (err) {
      console.error("Microphone access failed:", err);
      toast.error("Could not access microphone. Please verify browser permissions.");
    }
  };

  // Stop recording microphone
  const stopRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current?.state !== "recording") return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // Transcribe recorded audio using Groq Whisper via Backend
  const handleTranscribe = async (blob: Blob) => {
    if (!token) return;
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      formData.append("audio", blob, `speaking_test.${extension}`);

      const response = await fetch(`${BACKEND_URL}/api/speaking/transcribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          typeof errorData?.error === "string"
            ? errorData.error
            : "Speech recognition failed. Please try recording again."
        );
      }

      const data = await response.json();
      setTranscript(data.transcript || "");
      toast.success("Speech transcribed successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to transcribe audio.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Evaluate the transcript using AI Mentor grading criteria
  const handleEvaluate = async () => {
    if (!token) return;
    if (!transcript || transcript.trim().length < 10) {
      toast.error("Please record a response first (minimum 10 characters transcribed).");
      return;
    }

    setIsGrading(true);
    setResult(null);
    setStreamingText("");

    try {
      const response = await fetch(`${BACKEND_URL}/api/speaking/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          part: currentPart.part,
          prompt: currentPart.question,
          transcript,
        }),
      });

      let accumulated = "";
      let finalResult: SpeakingResult | null = null;

      await readSseEvents<{ token?: string; done?: boolean; id?: string; result?: Partial<SpeakingResult> }>(
        response,
        (data) => {
          if (data.token) {
            accumulated += data.token;
            setStreamingText(accumulated);
          } else if (data.done) {
            if (!data.result) {
              throw new Error("The evaluation server completed without a result.");
            }
            finalResult = {
              id: data.id,
              band_score: Number(data.result.band_score),
              fluency_coherence: Number(data.result.fluency_coherence),
              lexical_resource: Number(data.result.lexical_resource),
              grammatical_range: Number(data.result.grammatical_range),
              pronunciation: Number(data.result.pronunciation),
              examiner_comments: data.result.examiner_comments || "",
              improvements: data.result.improvements || [],
            };
          }
        }
      );

      if (finalResult) {
        setResult(finalResult);
        toast.success("Speaking response evaluated!");
      } else {
        throw new Error("Failed to receive completed speaking evaluation from server.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to grade speaking attempt.");
    } finally {
      setIsGrading(false);
      setStreamingText("");
    }
  };

  const handleNextPart = () => {
    if (currentPartIdx < SPEAKING_PARTS.length - 1) {
      setCurrentPartIdx((prev) => prev + 1);
      setTranscript("");
      setResult(null);
      setNotepadText("");
    }
  };

  const handleReset = () => {
    setTranscript("");
    setResult(null);
    setRecordingSeconds(0);
    setPrepSeconds(0);
    setNotepadText("");
    router.replace("/speaking");
  };

  const getTimerString = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const getTextSizeClass = () => {
    if (fontScale === "sm") return "text-xs";
    if (fontScale === "lg") return "text-base";
    return "text-sm";
  };

  if (isAuthLoading) {
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
    <div className="min-h-screen bg-muted/20 flex flex-col justify-between" style={{
      "--scrollbar-thumb": "rgba(100, 116, 139, 0.4)",
      "--scrollbar-track": "rgba(241, 245, 249, 0.5)"
    } as CSSProperties}>
      {/* Dynamic Keyframe style tag */}
      <style>{`
        @keyframes speaking-bar-pulse {
          0%, 100% { height: 4px; }
          50% { height: 28px; }
        }
        .speaking-bar {
          animation: speaking-bar-pulse 1s ease-in-out infinite;
        }
      `}</style>

      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-muted/50 bg-[#333f48] text-white px-6 h-16 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 mr-1 text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </a>
          <span className="font-bold tracking-tight text-white">IELTS Speaking Practice</span>
        </div>

        {/* Center Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase bg-primary px-2.5 py-1 rounded font-extrabold tracking-wider">
            Recorded Practice
          </span>
          <span className="text-xs text-white/70 font-bold border-l border-white/20 pl-2">
            Part {currentPart.part} of 3
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Font Resizing Controls */}
          <div className="flex items-center gap-1 bg-[#222a30] rounded-md p-1 border border-white/10">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setFontScale("sm")}
              className={`h-7 w-7 text-xs ${fontScale === "sm" ? "bg-primary text-white" : "text-white/70"}`}
            >
              A-
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setFontScale("base")}
              className={`h-7 w-7 text-xs ${fontScale === "base" ? "bg-primary text-white" : "text-white/70"}`}
            >
              A
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setFontScale("lg")}
              className={`h-7 w-7 text-xs ${fontScale === "lg" ? "bg-primary text-white" : "text-white/70"}`}
            >
              A+
            </Button>
          </div>

          {/* Candidate Info */}
          <div className="hidden md:flex flex-col items-end text-xs">
            <span className="font-bold text-white/95 capitalize">{candidateName}</span>
            <span className="text-white/60 font-mono text-[10px]">{candidateId}</span>
          </div>

          <a href="/dashboard" className="text-xs font-bold text-[#ffc72c] hover:underline">
            Exit
          </a>
        </div>
      </header>

      {/* Main split-screen Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {!result ? (
          <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
            
            {/* Left Panel: recorded examiner prompt */}
            <div className="flex-1 bg-slate-950 p-6 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-slate-800">
              <div className="flex justify-between items-center z-10">
                    <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/50 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] text-white font-bold tracking-wider uppercase">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Recorded examiner simulation
                    </div>
                    <div className="bg-slate-900/80 border border-slate-700/50 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] text-white/70 font-semibold font-mono">
                      Part {currentPart.part}
                    </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center py-8 relative">
                    <div className={`w-full max-w-xl aspect-video bg-slate-900 border-4 rounded-2xl relative overflow-hidden shadow-2xl transition-all duration-300 ${
                      isSpeakingPrompt ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "border-slate-800"
                    }`}>
                      <img
                        src="/examiner.png"
                        alt="Dr. Sarah Jenkins"
                        className={`w-full h-full object-cover transition-transform duration-500 ${isSpeakingPrompt ? "scale-105" : "scale-100"}`}
                      />
                      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-md text-[10px] text-white font-semibold">
                        Dr. Sarah Jenkins (Recorded Examiner)
                      </div>
                      {isSpeakingPrompt && (
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded animate-pulse">
                          Speaking
                        </div>
                      )}
                    </div>

                    <div className="absolute bottom-2 left-0 right-0 mx-auto max-w-lg bg-black/75 border border-slate-800 backdrop-blur rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1">
                        <Volume2 className="h-3.5 w-3.5 text-[#ffc72c]" /> Closed Captions
                      </p>
                      <p className={`${getTextSizeClass()} text-white leading-relaxed font-medium`}>
                        &ldquo;{currentPart.question}&rdquo;
                      </p>
                      <Button
                        onClick={speakQuestion}
                        variant="ghost"
                        size="xs"
                        className="mt-2 text-[10px] text-[#ffc72c] h-6 border border-[#ffc72c]/30 hover:bg-[#ffc72c]/10 hover:text-[#ffb700]"
                        disabled={isSpeakingPrompt}
                      >
                        {isSpeakingPrompt ? "Examiner Speaking..." : "Play Voice Prompts"}
                      </Button>
                    </div>
              </div>
            </div>

            {/* Right Panel: Candidate Workspace (Webcam stream mockup & Prep / controls) */}
            <div className="w-full lg:w-[480px] xl:w-[540px] overflow-y-auto bg-muted/15 p-6 flex flex-col justify-between shrink-0" style={{
              scrollbarColor: "var(--scrollbar-thumb) var(--scrollbar-track)",
              scrollbarWidth: "thin"
            }}>
              
              <div className="space-y-6 flex-grow">
                {/* 1. Candidate Webcam container */}
                <div className="aspect-video bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden flex flex-col items-center justify-center shadow-md">
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded text-[9px] text-white font-bold font-mono z-10">
                    {isRecording ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                        REC LIVE
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        PREVIEW ONLY
                      </>
                    )}
                  </div>

                  {cameraStream ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Mic className={`h-12 w-12 text-slate-700 ${isRecording ? "text-primary animate-pulse" : ""}`} />
                    </div>
                  )}

                  <div className="absolute bottom-2 right-2 text-[9px] text-slate-400 bg-black/60 px-2 py-0.5 rounded font-mono font-bold capitalize z-10">
                    {candidateName}
                  </div>

                  {/* Camera toggle button */}
                  <div className="absolute top-2 right-2 z-10">
                    <Button
                      onClick={toggleCamera}
                      variant="outline"
                      size="xs"
                      className="text-[9px] h-5 bg-black/60 border-white/25 hover:bg-black/90 text-white font-bold"
                    >
                      {cameraStream ? "Camera On" : "Turn On Camera"}
                    </Button>
                  </div>

                  {/* Audio Visualizer Wave overlay */}
                  {isRecording && (
                    <div className="absolute bottom-2 left-2 flex items-end gap-1 h-6">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-primary rounded-full speaking-bar"
                          style={{
                            height: `${[30, 80, 50, 90, 60, 40, 70, 30][i]}%`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Cue Card Info / Prep Timers */}
                {currentPart.part === 2 && (
                  <Card className="border-amber-100 bg-amber-50/10 shadow-xs">
                    <CardHeader className="p-4 pb-2 border-b border-amber-100/30">
                      <CardTitle className="text-xs font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Part 2 Cue Card (Long Turn)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {isPrepping ? (
                        <div className="text-center space-y-1 py-2">
                          <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Preparation Countdown</div>
                          <div className="text-3xl font-black text-amber-500 font-mono animate-pulse">{prepSeconds}s</div>
                          <p className="text-[10px] text-muted-foreground">Recording will auto-start. Note points below.</p>
                          <Button onClick={startRecording} size="sm" className="mt-2 h-7 bg-amber-500 hover:bg-amber-600 text-[10px]">
                            Skip & Speak Now
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button onClick={startPrepTimer} size="sm" variant="outline" className="text-xs h-9 border-amber-300 text-amber-600 hover:bg-amber-50/50">
                            Start 1-Min Prep
                          </Button>
                          <Button onClick={startRecording} size="sm" className="text-xs h-9 bg-primary">
                            Speak Directly
                          </Button>
                        </div>
                      )}

                      {/* notepad for cue card */}
                      <div className="space-y-1 mt-2">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Digital Notepad (Cue Card Notes)</label>
                        <Textarea 
                          placeholder="Jot down prompt bullet points here during prep time..."
                          value={notepadText}
                          onChange={(e) => setNotepadText(e.target.value)}
                          className="min-h-[80px] text-xs font-sans leading-relaxed"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 3. Recording Progress Controls */}
                <div className="bg-background rounded-xl p-4 border border-muted/50 flex flex-col items-center justify-center space-y-3 shadow-xs">
                  {isRecording ? (
                    <div className="text-center space-y-2">
                      <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest animate-pulse">Recording Speech</div>
                      <div className="text-3xl font-black font-mono text-foreground">{getTimerString(recordingSeconds)}</div>
                      <Button onClick={stopRecording} variant="destructive" size="icon" className="h-10 w-10 rounded-full flex items-center justify-center p-0 shadow-md">
                        <Square className="h-4 w-4 fill-current" />
                      </Button>
                    </div>
                  ) : currentPart.part !== 2 ? (
                    <div className="text-center space-y-1.5 py-1">
                      <p className="text-xs text-muted-foreground">Click below to record your Part {currentPart.part} response.</p>
                      <Button onClick={startRecording} size="lg" className="h-10 bg-primary gap-1.5">
                        <Mic className="h-4 w-4" /> Record Response
                      </Button>
                    </div>
                  ) : (
                    !isPrepping && (
                      <p className="text-xs text-muted-foreground text-center">Start preparation timer or direct recording above.</p>
                    )
                  )}
                </div>

                {/* 4. Speech Transcript display */}
                {(isTranscribing || transcript) && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Response Transcription</label>
                    {isTranscribing ? (
                      <div className="rounded-xl border border-muted/50 p-4 bg-background/50 flex items-center gap-3 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                        <span>Transcribing your speech with Whisper AI...</span>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-muted/50 p-4 bg-background/50 text-xs text-foreground leading-relaxed font-medium max-h-[140px] overflow-y-auto">
                        {transcript}
                      </p>
                    )}
                  </div>
                )}

                {isGrading && (
                  <div className="space-y-1 mt-3">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-primary block flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Live AI Examiner Feedback Stream
                    </label>
                    <div className="rounded-xl border border-emerald-500/20 bg-background/50 backdrop-blur-md p-4 text-[11px] font-mono text-foreground leading-relaxed h-[140px] overflow-y-auto whitespace-pre-wrap shadow-inner relative">
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-violet-500 via-primary to-emerald-500 animate-pulse" />
                      {streamingText || "Analysing speech, vocabulary, and grammar..."}
                      <span className="inline-block w-1 h-3 bg-primary ml-0.5 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons (Grade) */}
              {transcript && !isTranscribing && !isRecording && (
                <div className="border-t border-muted/50 pt-4 mt-6 flex justify-between items-center">
                  <Button onClick={handleReset} variant="ghost" size="sm" className="gap-1 text-muted-foreground text-xs">
                    <RefreshCw className="h-3.5 w-3.5" /> Reset Response
                  </Button>
                  <Button onClick={handleEvaluate} size="sm" disabled={isGrading} className="gap-1 text-xs">
                    {isGrading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Evaluating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" /> Submit Response
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Full-screen Speaking Grade Report
          <div className="flex-1 overflow-y-auto bg-background px-8 py-8" style={{
            scrollbarColor: "var(--scrollbar-thumb) var(--scrollbar-track)",
            scrollbarWidth: "thin"
          }}>
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">IELTS Speaking Grade Report</h2>
                <Button onClick={() => setResult(null)} variant="outline" size="sm" className="h-8">
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Evaluate New Speaking
                </Button>
              </div>

              {/* Score summary block */}
              <Card className="shadow-md border-muted/50">
                <CardHeader className="pb-3 text-center">
                  <CardTitle className="text-base font-bold">Estimated Speaking Band</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center space-y-3">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/10 bg-primary/5 shadow-xs">
                    <div className="text-center">
                      <span className="text-3xl font-black text-primary font-mono block leading-none">
                        {result.band_score.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1 block">
                        Band
                      </span>
                    </div>
                  </div>
                  <div className="text-center space-y-0.5">
                    <h3 className="font-extrabold text-base text-foreground">Speaking Performance</h3>
                    <p className="text-xs text-muted-foreground text-center">
                      AI is evaluating lexical grammar range, vocabulary collocations, fluency speed, and pronunciation features.
                    </p>
                  </div>

                  {/* Criteria Grid */}
                  <div className="grid grid-cols-2 gap-4 w-full max-w-xl pt-4">
                    {[
                      { label: "Fluency & Coherence", score: result.fluency_coherence },
                      { label: "Lexical Resource", score: result.lexical_resource },
                      { label: "Grammatical Range & Accuracy", score: result.grammatical_range },
                      { label: "Pronunciation Estimate", score: result.pronunciation },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-muted/50 bg-background/50 space-y-1">
                        <div className="text-[10px] font-semibold text-muted-foreground leading-tight truncate">{item.label}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold font-mono text-foreground">
                            Band {item.score?.toFixed(1) || "N/A"}
                          </span>
                          <span className={`h-2 w-2 rounded-full ${
                            item.score >= 7.0 ? "bg-emerald-500" : item.score >= 6.0 ? "bg-blue-500" : "bg-amber-500"
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Examiner comments */}
              <Card className="shadow-md border-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    Examiner Comments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {result.examiner_comments}
                  </p>
                </CardContent>
              </Card>

              {/* Speaking suggestions */}
              <Card className="shadow-md border-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Key Vocabulary & Fluency Upgrades</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {result.improvements.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Candidate Transcript Reference */}
              <Card className="shadow-md border-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Your Response Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/10 p-4 rounded-xl border border-muted/50 font-sans select-text">
                    {transcript}
                  </p>
                </CardContent>
              </Card>

              {/* Part controls */}
              {currentPartIdx < SPEAKING_PARTS.length - 1 ? (
                <Button onClick={handleNextPart} className="w-full h-11">
                  Advance to Part {currentPart.part + 1}
                </Button>
              ) : (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
                  <p className="text-sm text-primary font-bold">
                    🎉 Outstanding job! You have completed all parts of the speaking examiner simulation.
                  </p>
                  <a href="/dashboard">
                    <Button size="sm" className="mt-1">
                      Return to Dashboard
                    </Button>
                  </a>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SpeakingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading speaking module...</p>
          </div>
        </div>
      }
    >
      <SpeakingPageContent />
    </Suspense>
  );
}
