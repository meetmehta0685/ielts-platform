"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle, Clock, BookOpen, Volume2, Mic, Play, Pause, Square, Award, ArrowRight, Video, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function calculateOverallIELTS(scores: number[]) {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const decimal = avg - Math.floor(avg);
  if (decimal < 0.25) return Math.floor(avg);
  if (decimal >= 0.25 && decimal < 0.75) return Math.floor(avg) + 0.5;
  return Math.floor(avg) + 1.0;
}

export default function SimulatorPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Candidate Details
  const [candidateName, setCandidateName] = useState("Candidate");
  const [candidateId, setCandidateId] = useState("ielts-candidate");

  // Steps: 'intro' | 'listening' | 'reading' | 'writing' | 'speaking' | 'report'
  const [step, setStep] = useState<"intro" | "listening" | "reading" | "writing" | "speaking" | "report">("intro");

  // CBT Configuration States
  const [isTimerHidden, setIsTimerHidden] = useState(false);
  const [fontScale, setFontScale] = useState<"sm" | "base" | "lg">("base");

  // Timer states
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Subscore variables cached from grading responses
  const [listeningScore, setListeningScore] = useState<number | null>(null);
  const [readingScore, setReadingScore] = useState<number | null>(null);
  const [writingScore, setWritingScore] = useState<number | null>(null);
  const [speakingScore, setSpeakingScore] = useState<number | null>(null);

  // Loading indicator for processing mid-step grading
  const [isProcessingStep, setIsProcessingStep] = useState(false);

  // ----------------------------------------------------
  // LISTENING MODULE LOCAL STATES
  // ----------------------------------------------------
  const [listeningAnswers, setListeningAnswers] = useState<Record<number, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);

  // ----------------------------------------------------
  // READING MODULE LOCAL STATES
  // ----------------------------------------------------
  const [readingAnswers, setReadingAnswers] = useState<Record<number, string>>({});

  // ----------------------------------------------------
  // WRITING MODULE LOCAL STATES
  // ----------------------------------------------------
  const [essay, setEssay] = useState("");
  const writingPrompt = "In many parts of the world, traditional local cultures are being lost as a result of globalization. What are the main problems associated with this trend, and what measures can be taken to mitigate these issues?";

  // ----------------------------------------------------
  // SPEAKING MODULE LOCAL STATES
  // ----------------------------------------------------
  const [transcript, setTranscript] = useState("");
  const [isSpeakingPrompt, setIsSpeakingPrompt] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingPrepSeconds, setSpeakingPrepSeconds] = useState(0);
  const [isSpeakingPrepping, setIsSpeakingPrepping] = useState(false);
  const [speakingNotepad, setSpeakingNotepad] = useState("");

  // Candidate Webcam stream and ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speakingPrepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speakingPromptText = "Let's talk about cultural traditions. Do you think it is important for a society to maintain its traditional cultural values in the modern era, and why?";

  // Auth fetch
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          toast.error("Please login to access the Exam Simulator.");
          router.push("/auth/login?redirect=/simulator");
        } else {
          setToken(session.access_token);
          if (session.user) {
            setCandidateName(session.user.email?.split("@")[0] || "Candidate");
            setCandidateId(`ielts-${session.user.id.substring(0, 8)}`);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsAuthLoading(false);
      }
    };
    fetchSession();
  }, [router]);

  // Set timer duration when step changes
  useEffect(() => {
    if (step === "listening") {
      setTimeLeft(1800); // 30 mins
      setIsTimerActive(true);
    } else if (step === "reading") {
      setTimeLeft(3600); // 60 mins
      setIsTimerActive(true);
    } else if (step === "writing") {
      setTimeLeft(3600); // 60 mins
      setIsTimerActive(true);
    } else if (step === "speaking") {
      setTimeLeft(720); // 12 mins
      setIsTimerActive(true);
    } else {
      setIsTimerActive(false);
      setTimeLeft(0);
    }
  }, [step]);

  // Countdown timer logic
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isTimerActive && timeLeft > 0 && !isProcessingStep) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer!);
            setIsTimerActive(false);
            toast.warning("Time has expired for this module! Submitting automatically...");
            if (step === "listening") {
              handleFinishListening();
            } else if (step === "reading") {
              handleFinishReading();
            } else if (step === "writing") {
              handleFinishWriting();
            } else if (step === "speaking") {
              handleFinishSpeaking();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTimerActive, timeLeft, step, isProcessingStep]);

  // ElevenLabs custom HTML5 audio ref
  const elevenLabsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clean timers on unmount
  useEffect(() => {
    return () => {
      if (speakingPrepTimerRef.current) clearInterval(speakingPrepTimerRef.current);
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

  // ----------------------------------------------------
  // TRANSITION & GRADING PIPELINES
  // ----------------------------------------------------
  const startSimulation = () => {
    setStep("listening");
  };

  const handleFinishListening = async () => {
    if (!token) return;
    setIsProcessingStep(true);
    setIsTimerActive(false);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      const response = await fetch(`${BACKEND_URL}/api/test/listening/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          test_id: "listening-1",
          answers: listeningAnswers,
        }),
      });

      if (!response.ok) throw new Error("Listening scoring failed");
      const resultData = await response.json();
      setListeningScore(resultData.band_score);
      toast.success("Listening portion recorded.");
      setStep("reading");
    } catch (err: any) {
      toast.error("Failed to grade Listening step. Moving forward with estimated 6.0.");
      setListeningScore(6.0);
      setStep("reading");
    } finally {
      setIsProcessingStep(false);
    }
  };

  const handleFinishReading = async () => {
    if (!token) return;
    setIsProcessingStep(true);
    setIsTimerActive(false);
    try {
      const response = await fetch(`${BACKEND_URL}/api/test/reading/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          test_id: "reading-1",
          answers: readingAnswers,
        }),
      });

      if (!response.ok) throw new Error("Reading scoring failed");
      const resultData = await response.json();
      setReadingScore(resultData.band_score);
      toast.success("Reading portion recorded.");
      setStep("writing");
    } catch (err: any) {
      toast.error("Failed to grade Reading step. Moving forward with estimated 6.0.");
      setReadingScore(6.0);
      setStep("writing");
    } finally {
      setIsProcessingStep(false);
    }
  };

  const handleFinishWriting = async () => {
    if (!token) return;
    setIsProcessingStep(true);
    setIsTimerActive(false);
    try {
      const response = await fetch(`${BACKEND_URL}/api/writing/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task_type: "task2",
          prompt: writingPrompt,
          essay,
        }),
      });

      if (!response.ok) throw new Error("Writing evaluation failed");
      if (!response.body) throw new Error("No response body received from stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalBandScore: number | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              const data = JSON.parse(dataStr);
              if (data.done && data.result) {
                finalBandScore = Number(data.result.band_score);
              }
            } catch (err) {
              // Ignore partial JSON error
            }
          }
        }
      }

      if (finalBandScore !== null) {
        setWritingScore(finalBandScore);
        toast.success("Writing portion evaluated.");
      } else {
        throw new Error("No final band score received.");
      }
      setStep("speaking");
    } catch (err: any) {
      console.error("[Simulator Writing Evaluation Error]:", err);
      toast.error("Failed to evaluate Writing step. Moving forward with estimated 6.0.");
      setWritingScore(6.0);
      setStep("speaking");
    } finally {
      setIsProcessingStep(false);
    }
  };

  const handleFinishSpeaking = async () => {
    if (!token) return;
    setIsProcessingStep(true);
    setIsTimerActive(false);
    try {
      const response = await fetch(`${BACKEND_URL}/api/speaking/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          part: 3,
          prompt: speakingPromptText,
          transcript,
        }),
      });

      if (!response.ok) throw new Error("Speaking evaluation failed");
      if (!response.body) throw new Error("No response body received from stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalBandScore: number | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              const data = JSON.parse(dataStr);
              if (data.done && data.result) {
                finalBandScore = Number(data.result.band_score);
              }
            } catch (err) {
              // Ignore partial JSON error
            }
          }
        }
      }

      if (finalBandScore !== null) {
        setSpeakingScore(finalBandScore);
        toast.success("Speaking portion graded. Simulation complete!");
      } else {
        throw new Error("No final band score received.");
      }
      setStep("report");
      syncStudyRoadmap();
    } catch (err: any) {
      console.error("[Simulator Speaking Evaluation Error]:", err);
      toast.error("Failed to grade Speaking step. Finishing simulation.");
      setSpeakingScore(6.5);
      setStep("report");
      syncStudyRoadmap();
    } finally {
      setIsProcessingStep(false);
    }
  };

  // Fallback to browser-native TTS
  const playBrowserSpeech = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
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

  // Speaking voice triggers
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
          text: speakingPromptText,
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
          playBrowserSpeech(speakingPromptText);
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
        setIsSpeakingPrompt(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = (e) => {
        console.error("[Audio Playback Error]", e);
        setIsSpeakingPrompt(false);
        URL.revokeObjectURL(audioUrl);
        // Fallback to browser synthesis
        playBrowserSpeech(speakingPromptText);
      };
      
      await audio.play();
    } catch (error) {
      console.warn("[ElevenLabs API Error] falling back to browser voice:", error);
      playBrowserSpeech(speakingPromptText);
    }
  };

  // Speaking Part 2 Preparation timer
  const startSpeakingPrepTimer = () => {
    setIsSpeakingPrepping(true);
    setSpeakingPrepSeconds(60);

    if (speakingPrepTimerRef.current) clearInterval(speakingPrepTimerRef.current);
    speakingPrepTimerRef.current = setInterval(() => {
      setSpeakingPrepSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(speakingPrepTimerRef.current!);
          setIsSpeakingPrepping(false);
          startSpeakingRecording(); // start automatically
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Speaking Recording triggers
  const startSpeakingRecording = async () => {
    if (isSpeakingPrepping) {
      if (speakingPrepTimerRef.current) clearInterval(speakingPrepTimerRef.current);
      setIsSpeakingPrepping(false);
    }

    setTranscript("");
    audioChunksRef.current = [];
    setRecordingSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        handleTranscribe(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 120) {
            stopSpeakingRecording();
            return 120;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      toast.error("Microphone access failed.");
    }
  };

  const stopSpeakingRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleTranscribe = async (blob: Blob) => {
    if (!token) return;
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "speak.webm");
      const res = await fetch(`${BACKEND_URL}/api/speaking/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Whisper fail");
      const data = await res.json();
      setTranscript(data.transcript);
    } catch (err) {
      toast.error("Audio transcription failed.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // Audio player triggers (Listening section)
  const toggleListeningPlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const getTextSizeClass = () => {
    if (fontScale === "sm") return "text-xs";
    if (fontScale === "lg") return "text-base";
    return "text-sm";
  };

  const syncStudyRoadmap = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/planner/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        toast.success("AI has automatically recalculated your study plan milestones based on these scores!");
      }
    } catch (err) {
      console.error("Auto-sync roadmap failed:", err);
    }
  };

  const handleDownloadTRF = () => {
    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) {
      toast.error("Failed to open print window. Please allow popups for this site.");
      return;
    }

    const testDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const cefrLevel = (score: number) => {
      if (score >= 8.5) return "C2";
      if (score >= 7.0) return "C1";
      if (score >= 5.5) return "B2";
      if (score >= 4.0) return "B1";
      return "A2";
    };

    const overall = overallScore !== null ? overallScore : 6.0;

    const trfHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>IELTS Test Report Form - ${candidateName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Courier+Prime&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body {
                background: white;
                color: black;
                padding: 0;
                margin: 0;
              }
              .no-print {
                display: none;
              }
              .print-container {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
            }
            body {
              font-family: 'Outfit', sans-serif;
              background-color: #f7f6f2;
            }
            .certificate-border {
              border: 8px double #1e3a8a;
            }
          </style>
        </head>
        <body class="p-6 md:p-12 flex flex-col items-center">
          <div class="no-print mb-6 flex gap-4">
            <button onclick="window.print()" class="bg-blue-950 hover:bg-blue-900 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all">
              Save as PDF / Print
            </button>
            <button onclick="window.close()" class="bg-stone-200 hover:bg-stone-300 text-slate-700 font-bold px-6 py-2.5 rounded-xl transition-all">
              Close Window
            </button>
          </div>

          <div class="print-container bg-white w-full max-w-[800px] p-8 md:p-12 rounded-3xl shadow-xl certificate-border relative text-slate-800">
            <!-- Corner Decorative Elements -->
            <div class="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-amber-500/40 rounded-tl-lg pointer-events-none"></div>
            <div class="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-amber-500/40 rounded-tr-lg pointer-events-none"></div>
            <div class="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-amber-500/40 rounded-bl-lg pointer-events-none"></div>
            <div class="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-amber-500/40 rounded-br-lg pointer-events-none"></div>

            <!-- Header Logos -->
            <div class="flex justify-between items-center border-b-2 border-stone-200 pb-6 mb-8">
              <div class="flex flex-col">
                <span class="text-3xl font-black tracking-tighter text-blue-950">IELTS</span>
                <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">English Language Testing System</span>
              </div>
              <div class="text-right">
                <span class="px-4 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-bold uppercase tracking-widest">
                  Academic Test Report
                </span>
              </div>
            </div>

            <div class="text-center mb-8">
              <h1 class="text-2xl font-black text-blue-950 uppercase tracking-wide">Test Report Form</h1>
              <p class="text-xs text-slate-500 mt-1">Admission & Assessment Verification Services</p>
            </div>

            <!-- Candidate Details Info Section -->
            <div class="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
              
              <!-- Profile Avatar / Box -->
              <div class="md:col-span-3 flex flex-col items-center justify-center">
                <div class="w-32 h-40 bg-stone-100 border border-stone-300 rounded-xl flex flex-col items-center justify-center text-center p-4 relative overflow-hidden shadow-inner">
                  <div class="text-4xl mb-2">👤</div>
                  <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Candidate Photo</span>
                  <div class="absolute bottom-0 left-0 w-full bg-slate-900/5 py-1 text-[8px] text-slate-500 uppercase tracking-widest font-mono">
                    Verified Digital
                  </div>
                </div>
              </div>

              <!-- Text Fields -->
              <div class="md:col-span-9 grid grid-cols-2 gap-y-4 gap-x-6 text-sm border-l border-stone-100 pl-0 md:pl-8">
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Candidate Name</span>
                  <span class="font-extrabold text-slate-800 capitalize text-base">${candidateName}</span>
                </div>
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Candidate Number</span>
                  <span class="font-bold text-slate-800 font-mono">${candidateId.toUpperCase()}</span>
                </div>
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Exam Date</span>
                  <span class="font-semibold text-slate-700">${testDate}</span>
                </div>
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Center Number</span>
                  <span class="font-bold text-slate-800 font-mono">AI-MTR-01</span>
                </div>
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Scheme Code</span>
                  <span class="font-semibold text-slate-700 font-mono">CBT - EXAM</span>
                </div>
                <div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CEFR Level Equivalency</span>
                  <span class="font-bold text-blue-900">${cefrLevel(overall)}</span>
                </div>
              </div>
            </div>

            <!-- Test Results Table -->
            <div class="border-2 border-slate-200 rounded-2xl overflow-hidden mb-8">
              <table class="w-full text-center text-sm">
                <thead>
                  <tr class="bg-stone-50 border-b-2 border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th class="py-3 px-4">Listening</th>
                    <th class="py-3 px-4 border-l border-slate-200">Reading</th>
                    <th class="py-3 px-4 border-l border-slate-200">Writing</th>
                    <th class="py-3 px-4 border-l border-slate-200">Speaking</th>
                    <th class="py-3 px-4 border-l border-slate-200 bg-amber-500/10 text-amber-950 font-black">Overall Band</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="font-extrabold text-slate-800 text-base">
                    <td class="py-4 px-4 font-mono">${listeningScore !== null ? listeningScore.toFixed(1) : "N/A"}</td>
                    <td class="py-4 px-4 border-l border-slate-200 font-mono">${readingScore !== null ? readingScore.toFixed(1) : "N/A"}</td>
                    <td class="py-4 px-4 border-l border-slate-200 font-mono">${writingScore !== null ? writingScore.toFixed(1) : "N/A"}</td>
                    <td class="py-4 px-4 border-l border-slate-200 font-mono">${speakingScore !== null ? speakingScore.toFixed(1) : "N/A"}</td>
                    <td class="py-4 px-4 border-l border-slate-200 bg-amber-500/10 text-xl font-black text-blue-950 font-mono">${overall.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- AI Advisor Strategist comments -->
            <div class="bg-stone-50 border border-stone-200 rounded-xl p-5 mb-8">
              <h3 class="font-bold text-xs text-blue-950 uppercase tracking-widest mb-2 flex items-center gap-1">
                <span>🌟</span> AI Coach Recommendations & Strategy
              </h3>
              <p class="text-xs text-slate-600 leading-relaxed font-medium">
                Candidate ${candidateName} achieved a Band score of ${overall.toFixed(1)}. 
                Based on diagnostic subscores, key improvement areas remain in ${
                  [
                    { name: "Listening", val: listeningScore || 6.0 },
                    { name: "Reading", val: readingScore || 6.0 },
                    { name: "Writing", val: writingScore || 6.0 },
                    { name: "Speaking", val: speakingScore || 6.0 },
                  ].sort((a, b) => a.val - b.val)[0]?.name
                } module practice. Prioritizing structured grammar feedback, expanding lexical resource variety, and sitting simulated exams under strict countdown constraints will assist in securing a target score of Band 7.5+.
              </p>
            </div>

            <!-- Validation stamps and signatures -->
            <div class="flex justify-between items-end pt-4">
              <div class="text-left">
                <div class="h-10 w-24 mb-1 flex items-center justify-center italic text-xs text-slate-400 font-mono">
                  Sarah Jenkins
                </div>
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-t border-stone-200 pt-1">
                  Administrator Signature
                </span>
              </div>
              <div class="text-center relative">
                <div class="absolute -top-12 -left-6 w-20 h-20 rounded-full border-4 border-dashed border-red-500/25 flex items-center justify-center text-[7px] text-red-500/40 uppercase font-black tracking-widest rotate-12 pointer-events-none">
                  AI Certified
                </div>
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-t border-stone-200 pt-1">
                  Validation Stamp
                </span>
              </div>
            </div>

            <!-- Document Footer -->
            <div class="mt-8 pt-4 border-t border-stone-100 flex justify-between text-[8px] text-slate-400 font-mono">
              <span>Security Code: IELTS-AI-${Math.random().toString(36).substring(2, 8).toUpperCase()}</span>
              <span>This is an AI-generated mock exam record for training purposes.</span>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(trfHtml);
    printWindow.document.close();
  };

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Initializing Exam Simulator...</p>
        </div>
      </div>
    );
  }

  const overallScore =
    listeningScore !== null &&
    readingScore !== null &&
    writingScore !== null &&
    speakingScore !== null
      ? calculateOverallIELTS([listeningScore, readingScore, writingScore, speakingScore])
      : null;

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col justify-between" style={{
      "--scrollbar-thumb": "rgba(100, 116, 139, 0.4)",
      "--scrollbar-track": "rgba(241, 245, 249, 0.5)"
    } as any}>
      {/* Dynamic Voice Pulse style */}
      <style>{`
        @keyframes speak-pulse {
          0%, 100% { height: 4px; }
          50% { height: 28px; }
        }
        .speaking-bar {
          animation: speak-pulse 1s ease-in-out infinite;
        }
      `}</style>

      {/* Top CBT Navigation Header (shows during modules, not in report/intro) */}
      {step !== "intro" && step !== "report" ? (
        <header className="sticky top-0 z-10 border-b border-muted/50 bg-[#333f48] text-white px-6 h-16 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <a href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 mr-1 text-white hover:bg-white/10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </a>
            <span className="font-bold tracking-tight text-white capitalize">IELTS CBT Mock Test - {step}</span>
          </div>

          {/* Center: CBT Timer */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[#222a30] text-white px-4 py-1.5 rounded-md border border-white/10 text-sm font-bold font-mono">
              <Clock className="h-4 w-4 text-[#ffc72c] animate-pulse" />
              <span>{isTimerHidden ? "--:--" : formatTime(timeLeft)}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsTimerHidden(!isTimerHidden)}
              className="text-xs h-8 border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white"
            >
              {isTimerHidden ? "Show Time" : "Hide Time"}
            </Button>
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
      ) : (
        <header className="sticky top-0 z-10 border-b border-muted/50 bg-background px-6 h-16 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <a href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 mr-1">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </a>
            <span className="font-extrabold text-foreground tracking-tight">IELTS Exam Simulator</span>
          </div>
          <span className="text-xs uppercase font-bold text-muted-foreground bg-muted border px-2.5 py-1 rounded-md">
            Exam Mode
          </span>
        </header>
      )}

      {/* Main Workspace content */}
      <div className="flex-1 flex overflow-hidden justify-center items-center">
        
        {/* STEP 1: INTRO */}
        {step === "intro" && (
          <div className="w-full max-w-4xl p-6 md:p-12 overflow-y-auto">
            <Card className="shadow-md border-muted/50">
              <CardHeader className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-black shadow-sm">
                  I
                </div>
                <CardTitle className="text-2xl font-black">Full IELTS CBT Mock Examination</CardTitle>
                <CardDescription className="max-w-md mx-auto">
                  Experience a complete computer-based test under realistic timing, layouts, and grading pipelines.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 max-w-xl mx-auto">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "1. Listening Mock", desc: "Orientation Lecture (30 mins)" },
                    { label: "2. Reading Mock", desc: "AI Passage (60 mins)" },
                    { label: "3. Writing Mock", desc: "Globalization Essay (60 mins)" },
                    { label: "4. Speaking VCS Interview", desc: "Dr. Jenkins (11-14 mins)" },
                  ].map((m, idx) => (
                    <div key={idx} className="p-3 border border-muted/50 rounded-xl bg-background text-xs space-y-0.5">
                      <div className="font-bold text-foreground">{m.label}</div>
                      <div className="text-muted-foreground">{m.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-primary leading-relaxed">
                  <strong>Important:</strong> Timers are strictly enforced for each section. When a timer expires, your answers will auto-submit. Ensure your microphone is ready for the speaking interview.
                </div>

                <Button onClick={startSimulation} className="w-full h-11">
                  Start Examination <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 2: LISTENING */}
        {step === "listening" && (
          <div className="w-full max-w-4xl p-6 md:p-12 overflow-y-auto">
            <Card className="shadow-md border-muted/50">
              <CardHeader className="pb-3 border-b border-muted/30">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg font-bold">Step 1: Listening Module</CardTitle>
                    <CardDescription>Listen to the library orientation audio and type answers in the blanks.</CardDescription>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground bg-muted border px-2 py-0.5 rounded-sm">Part 1</span>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <audio
                  ref={audioRef}
                  src="/audio/listening-test-1.mp3"
                  onTimeUpdate={() => setAudioProgress(audioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
                />
                
                <div className="flex items-center gap-4 border border-muted/40 p-4 rounded-xl bg-muted/10">
                  <Button
                    onClick={toggleListeningPlay}
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    disabled={isProcessingStep}
                  >
                    {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                  </Button>
                  <div className="flex-1 space-y-0.5">
                    <div className="text-xs font-bold text-primary">University Library Orientation Audio</div>
                    <input
                      type="range"
                      min="0"
                      max={audioDuration || 100}
                      value={audioProgress}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (audioRef.current) audioRef.current.currentTime = val;
                        setAudioProgress(val);
                      }}
                      className="w-full h-1 bg-muted rounded appearance-none accent-primary cursor-pointer"
                      disabled={isProcessingStep}
                    />
                  </div>
                </div>

                {/* Questions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 1, label: "The library was established in _____." },
                    { id: 3, label: "Students can borrow a maximum of _____ books." },
                    { id: 5, label: "The library closes at _____ PM on weekends." }
                  ].map((q) => (
                    <div key={q.id} className="p-3 border border-muted/50 rounded-xl space-y-2 bg-background">
                      <div className="text-xs font-bold text-muted-foreground">Question {q.id}</div>
                      <p className={`${getTextSizeClass()} font-semibold leading-normal text-foreground`}>{q.label}</p>
                      <Input
                        placeholder="Type answer..."
                        value={listeningAnswers[q.id] || ""}
                        onChange={(e) => setListeningAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="h-8 text-xs"
                        disabled={isProcessingStep}
                      />
                    </div>
                  ))}
                </div>

                <Button onClick={handleFinishListening} className="w-full h-11" disabled={isProcessingStep}>
                  {isProcessingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit & Continue to Reading"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 3: READING - CBT SPLIT VIEW */}
        {step === "reading" && (
          <div className="flex-1 flex h-full overflow-hidden">
            {/* Left Column: Passage with independent scroll */}
            <div className="flex-1 overflow-y-auto px-8 py-8 bg-background border-r border-muted/50" style={{
              scrollbarColor: "var(--scrollbar-thumb) var(--scrollbar-track)",
              scrollbarWidth: "thin"
            }}>
              <div className="max-w-2xl mx-auto space-y-6">
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Passage: AI in Education
                </h1>
                <p className={`${getTextSizeClass()} text-foreground/90 leading-relaxed font-sans whitespace-pre-wrap select-text antialiased`}>
                  Artificial Intelligence (AI) is rapidly transforming educational systems worldwide. From personalized tutoring software that adapts to a student's learning pace to automated grading systems, AI integration aims to optimize pedagogical efficiency. 
                  Proponents argue that intelligent tutoring systems allow educators to commit more energy to mentoring and emotional guidance. For example, AI algorithms can analyze a student's performance in real time, detecting conceptual weaknesses and generating targeted remedial exercises. 
                  However, critics express concern over privacy, data security, and the danger of replacing human teachers with rigid algorithms. They emphasize that critical thinking, empathy, and social cooperation are inherently human traits that cannot be programmed.
                </p>
              </div>
            </div>

            {/* Right Column: Questions with independent scroll */}
            <div className="w-[480px] md:w-[540px] overflow-y-auto bg-muted/30 px-8 py-8 flex flex-col justify-between shrink-0" style={{
              scrollbarColor: "var(--scrollbar-thumb) var(--scrollbar-track)",
              scrollbarWidth: "thin"
            }}>
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Answer Questions 2 & 3</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Select TRUE or FALSE based on the passage text.</p>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 2, text: "Personalized tutoring software adapts to student performance in real time." },
                    { id: 3, text: "Data privacy is a minor issue for critics of classroom AI implementation." }
                  ].map((q) => (
                    <div key={q.id} className="p-4 border border-muted/50 bg-background rounded-xl space-y-3 shadow-xs">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase font-mono">Question {q.id}</div>
                      <p className={`${getTextSizeClass()} font-semibold leading-normal text-foreground`}>{q.text}</p>
                      <div className="flex gap-2">
                        {["TRUE", "FALSE"].map(opt => {
                          const isSel = readingAnswers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setReadingAnswers(prev => ({ ...prev, [q.id]: opt }))}
                              className={`px-3 py-1.5 rounded-lg border font-bold text-xs cursor-pointer transition-all ${
                                isSel ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:bg-muted"
                              }`}
                              disabled={isProcessingStep}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleFinishReading} className="w-full h-11 mt-8" disabled={isProcessingStep}>
                {isProcessingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit & Continue to Writing"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: WRITING - CBT SPLIT VIEW */}
        {step === "writing" && (
          <div className="flex-1 flex h-full overflow-hidden">
            {/* Left Column: essay prompt */}
            <div className="flex-1 overflow-y-auto px-8 py-8 bg-background border-r border-muted/50" style={{
              scrollbarColor: "var(--scrollbar-thumb) var(--scrollbar-track)",
              scrollbarWidth: "thin"
            }}>
              <div className="max-w-2xl mx-auto space-y-6">
                <div>
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    <PenTool className="h-5 w-5 text-primary" />
                    Writing Task 2 (Essay)
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1">Write an essay in response to the topic below (minimum 250 words).</p>
                </div>
                <div className={`${getTextSizeClass()} rounded-xl border border-muted/80 bg-muted/10 p-5 font-bold leading-relaxed text-foreground select-text`}>
                  "{writingPrompt}"
                </div>
              </div>
            </div>

            {/* Right Column: response editor */}
            <div className="w-[480px] md:w-[540px] lg:w-[600px] overflow-y-auto bg-muted/30 px-8 py-8 flex flex-col justify-between shrink-0" style={{
              scrollbarColor: "var(--scrollbar-thumb) var(--scrollbar-track)",
              scrollbarWidth: "thin"
            }}>
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your Response</label>
                  <span className={`text-xs font-mono font-bold ${
                    essay.trim().split(/\s+/).length < 250 ? "text-amber-500" : "text-emerald-500"
                  }`}>
                    Words: {essay.trim() === "" ? 0 : essay.trim().split(/\s+/).length} / 250
                  </span>
                </div>
                <Textarea
                  placeholder="Type essay response here..."
                  value={essay}
                  onChange={(e) => setEssay(e.target.value)}
                  className={`${getTextSizeClass()} flex-1 min-h-[400px] font-sans leading-relaxed resize-none p-4 rounded-xl border border-muted/50 focus:ring-1 focus:ring-primary`}
                  disabled={isProcessingStep}
                />
              </div>

              <Button onClick={handleFinishWriting} className="w-full h-11 mt-6" disabled={isProcessingStep}>
                {isProcessingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit & Continue to Speaking"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: SPEAKING - VCS VIDEO INTERVIEW MOCKUP */}
        {step === "speaking" && (
          <div className="flex-1 flex h-full overflow-hidden flex-col lg:flex-row">
            
            {/* Left Panel: Examiner Stream mockup */}
            <div className="flex-1 bg-slate-950 p-6 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-slate-800">
              <div className="flex justify-between items-center z-10">
                <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/50 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] text-white font-bold tracking-wider uppercase">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Examiner Video Call: Connected
                </div>
                <div className="bg-slate-900/80 border border-slate-700/50 backdrop-blur px-3 py-1.5 rounded-lg text-[10px] text-white/70 font-semibold font-mono">
                  Mock Interview Mode
                </div>
              </div>

              {/* Examiner Video Stream Window */}
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
                    Dr. Sarah Jenkins (IELTS VCS Examiner)
                  </div>
                  {isSpeakingPrompt && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded animate-pulse">
                      Speaking
                    </div>
                  )}
                </div>

                {/* Subtitles Overlay */}
                <div className="absolute bottom-2 left-0 right-0 mx-auto max-w-lg bg-black/75 border border-slate-800 backdrop-blur rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1">
                    <Volume2 className="h-3.5 w-3.5 text-[#ffc72c]" /> Closed Captions
                  </p>
                  <p className={`${getTextSizeClass()} text-white leading-relaxed font-medium`}>
                    "{speakingPromptText}"
                  </p>
                  <Button
                    onClick={speakQuestion}
                    variant="ghost"
                    size="xs"
                    className="mt-2 text-[10px] text-[#ffc72c] h-6 border border-[#ffc72c]/30 hover:bg-[#ffc72c]/10 hover:text-[#ffb700]"
                    disabled={isSpeakingPrompt}
                  >
                    {isSpeakingPrompt ? "Examiner Speaking..." : "Play Examiner Voice"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Panel: Candidate Workspace */}
            <div className="w-full lg:w-[480px] xl:w-[540px] overflow-y-auto bg-muted/15 p-6 flex flex-col justify-between shrink-0" style={{
              scrollbarColor: "var(--scrollbar-thumb) var(--scrollbar-track)",
              scrollbarWidth: "thin"
            }}>
              
              <div className="space-y-6 flex-grow">
                {/* Candidate Webcam container */}
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

                  {/* Audio Visualizer Wave */}
                  {isRecording && (
                    <div className="absolute bottom-2 left-2 flex items-end gap-1 h-6">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-primary rounded-full speaking-bar"
                          style={{
                            height: `${[35, 75, 45, 95, 55, 35, 65, 30][i]}%`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Cue Card / Prep notes */}
                <Card className="border-amber-100 bg-amber-50/10 shadow-xs">
                  <CardHeader className="p-4 pb-2 border-b border-amber-100/30">
                    <CardTitle className="text-xs font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Part 2 Cue Card (Long Turn)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {isSpeakingPrepping ? (
                      <div className="text-center space-y-1 py-2">
                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Preparation Countdown</div>
                        <div className="text-3xl font-black text-amber-500 font-mono animate-pulse">{speakingPrepSeconds}s</div>
                        <p className="text-[10px] text-muted-foreground">Recording will auto-start. Note points below.</p>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button onClick={startSpeakingPrepTimer} size="sm" variant="outline" className="text-xs h-9 border-amber-300 text-amber-600 hover:bg-amber-50/50">
                          Start 1-Min Prep
                        </Button>
                        <Button onClick={startSpeakingRecording} size="sm" className="text-xs h-9 bg-primary">
                          Speak Directly
                        </Button>
                      </div>
                    )}

                    <div className="space-y-1 mt-2">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Notepad Notes</label>
                      <Textarea 
                        placeholder="Write down brief notes here..."
                        value={speakingNotepad}
                        onChange={(e) => setSpeakingNotepad(e.target.value)}
                        className="min-h-[80px] text-xs font-sans leading-relaxed"
                        disabled={isProcessingStep}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Controls */}
                <div className="bg-background rounded-xl p-4 border border-muted/50 flex flex-col items-center justify-center space-y-3 shadow-xs">
                  {isRecording ? (
                    <div className="text-center space-y-2">
                      <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest animate-pulse">Recording Speech</div>
                      <div className="text-3xl font-black font-mono text-foreground">{formatTime(recordingSeconds)}</div>
                      <Button onClick={stopSpeakingRecording} variant="destructive" size="icon" className="h-10 w-10 rounded-full flex items-center justify-center p-0 shadow-md">
                        <Square className="h-4 w-4 fill-current" />
                      </Button>
                    </div>
                  ) : (
                    !isSpeakingPrepping && (
                      <div className="text-center space-y-1.5 py-1">
                        <p className="text-xs text-muted-foreground">Record response to examiner prompt above.</p>
                        <Button onClick={startSpeakingRecording} size="lg" className="h-10 bg-primary gap-1.5" disabled={isProcessingStep}>
                          <Mic className="h-4 w-4" /> Record Speech
                        </Button>
                      </div>
                    )
                  )}
                </div>

                {/* Spoken Transcript */}
                {(isTranscribing || transcript) && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Spoken Transcript</label>
                    {isTranscribing ? (
                      <div className="rounded-xl border border-muted/50 p-4 bg-background/50 flex items-center gap-3 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                        <span>Transcribing audio with Whisper AI...</span>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-muted/50 p-4 bg-background/50 text-xs text-foreground leading-relaxed font-medium max-h-[140px] overflow-y-auto">
                        {transcript}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Submission block */}
              {transcript && !isTranscribing && !isRecording && (
                <Button onClick={handleFinishSpeaking} className="w-full h-11 mt-6" disabled={isProcessingStep}>
                  {isProcessingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Examination Simulator"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STEP 6: CONSOLIDATED REPORT */}
        {step === "report" && overallScore !== null && (
          <div className="w-full max-w-4xl p-6 md:p-12 overflow-y-auto">
            <Card className="shadow-md border-muted/50 overflow-hidden">
              <div className="bg-primary/5 border-b border-primary/10 py-6 text-center space-y-2">
                <h2 className="text-2xl font-black text-foreground">Consolidated IELTS Report</h2>
                <p className="text-xs text-muted-foreground">Overall band calculated according to official IELTS grading metrics.</p>
              </div>
              <CardContent className="p-8 space-y-8">
                {/* circular badge */}
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-primary/10 bg-primary/5 shadow-xs">
                    <div className="text-center">
                      <span className="text-4xl font-black text-primary font-mono block leading-none">
                        {overallScore.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 block">
                        Band
                      </span>
                    </div>
                  </div>
                  <h3 className="font-extrabold text-lg text-foreground">Estimated IELTS Score</h3>
                  <p className="text-xs text-muted-foreground text-center max-w-sm">
                    This represents your mock level. Focus on your weaker subsections in writing/speaking to push this average to 8.0+.
                  </p>
                </div>

                {/* subscores */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { module: "Listening", score: listeningScore },
                    { module: "Reading", score: readingScore },
                    { module: "Writing", score: writingScore },
                    { module: "Speaking", score: speakingScore },
                  ].map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-muted/50 bg-background text-center space-y-1.5 shadow-xs">
                      <div className="text-xs font-bold text-muted-foreground">{item.module}</div>
                      <div className="text-xl font-black font-mono text-primary">
                        Band {item.score !== null ? item.score.toFixed(1) : "N/A"}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <Button 
                    onClick={handleDownloadTRF} 
                    variant="outline" 
                    className="flex-1 h-11 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer font-semibold"
                  >
                    Download Test Report Card (TRF)
                  </Button>
                  <a href="/dashboard" className="flex-1">
                    <Button className="w-full h-11 cursor-pointer font-semibold">
                      Return to Dashboard
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
