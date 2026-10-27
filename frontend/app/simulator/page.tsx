"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { readSseEvents } from "@/lib/sse";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Clock, BookOpen, Play, Pause, ArrowRight, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SpeakingLiveKitRoom = dynamic(
  () => import("@/components/simulator/speaking-livekit-room"),
  { ssr: false },
);

type Question = {
  id: number;
  type: "fill-gap" | "multiple-choice" | "true-false-not-given";
  questionText: string;
  options?: string[];
};

type ListeningTest = {
  id: string;
  title: string;
  sections: { id: number; audioUrl: string; instructions: string; questions: Question[] }[];
};

type ReadingTest = {
  id: string;
  title: string;
  passages: { id: number; title: string; text: string; questions: Question[] }[];
};

type Step = "intro" | "listening" | "reading" | "writing" | "speaking" | "report";

const STEP_SECONDS: Partial<Record<Step, number>> = {
  listening: 30 * 60,
  reading: 60 * 60,
  writing: 60 * 60,
  speaking: 12 * 60,
};

const createAttemptId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`;

type EvaluationEvent = { done?: boolean; result?: { band_score?: number } };

function calculateOverallIELTS(scores: number[]) {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const decimal = avg - Math.floor(avg);
  if (decimal < 0.25) return Math.floor(avg);
  if (decimal >= 0.25 && decimal < 0.75) return Math.floor(avg) + 0.5;
  return Math.floor(avg) + 1.0;
}

const formatBand = (score: number | null) => (score !== null ? score.toFixed(1) : "Not graded");

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

async function streamBandScore(response: Response) {
  let bandScore: number | null = null;
  await readSseEvents<EvaluationEvent>(response, (event) => {
    if (event.done && typeof event.result?.band_score === "number") {
      bandScore = event.result.band_score;
    }
  });
  if (bandScore === null) throw new Error("No final band score received.");
  return bandScore;
}

function QuestionField({
  question,
  value,
  onChange,
  disabled,
  textSizeClass,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  textSizeClass: string;
}) {
  const choices =
    question.type === "true-false-not-given"
      ? ["TRUE", "FALSE", "NOT GIVEN"].map((opt) => ({ label: opt, value: opt }))
      : question.type === "multiple-choice"
        ? (question.options ?? []).map((opt) => ({ label: opt, value: opt.charAt(0) }))
        : null;

  return (
    <div className="p-4 border border-muted/50 bg-background rounded-xl space-y-3 shadow-xs">
      <div className="text-[10px] font-bold text-muted-foreground uppercase font-mono">Question {question.id}</div>
      <p className={`${textSizeClass} font-semibold leading-normal text-foreground`}>{question.questionText}</p>
      {choices ? (
        <div className={question.type === "multiple-choice" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
          {choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              onClick={() => onChange(choice.value)}
              className={`px-3 py-1.5 rounded-lg border font-bold text-xs text-left cursor-pointer transition-all ${
                value === choice.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:bg-muted"
              }`}
              disabled={disabled}
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : (
        <Input
          placeholder="Type answer..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
          disabled={disabled}
        />
      )}
    </div>
  );
}

function TestLoadingState({ error }: { error: string | null }) {
  return error ? (
    <p className="text-sm text-destructive">Failed to load this test: {error}. Submit to continue; this module will be marked Not graded.</p>
  ) : (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading test...
    </div>
  );
}

export default function SimulatorPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Candidate Details
  const [candidateName, setCandidateName] = useState("Candidate");
  const [candidateId, setCandidateId] = useState("ielts-candidate");
  const [examAttemptId] = useState(createAttemptId);

  const [step, setStep] = useState<Step>("intro");

  // CBT Configuration States
  const [isTimerHidden, setIsTimerHidden] = useState(false);
  const [fontScale, setFontScale] = useState<"sm" | "base" | "lg">("base");

  // Timer states
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Band scores; null means the module could not be graded
  const [listeningScore, setListeningScore] = useState<number | null>(null);
  const [readingScore, setReadingScore] = useState<number | null>(null);
  const [writingScore, setWritingScore] = useState<number | null>(null);
  const [speakingScore, setSpeakingScore] = useState<number | null>(null);

  // Loading indicator for processing mid-step grading
  const [isProcessingStep, setIsProcessingStep] = useState(false);
  const processingRef = useRef(false);

  // ----------------------------------------------------
  // LISTENING & READING MODULE LOCAL STATES
  // ----------------------------------------------------
  const [listeningTest, setListeningTest] = useState<ListeningTest | null>(null);
  const [readingTest, setReadingTest] = useState<ReadingTest | null>(null);
  const [testsError, setTestsError] = useState<string | null>(null);
  const [listeningAnswers, setListeningAnswers] = useState<Record<number, string>>({});
  const [readingAnswers, setReadingAnswers] = useState<Record<number, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);

  // ----------------------------------------------------
  // WRITING MODULE LOCAL STATES
  // ----------------------------------------------------
  const [essay, setEssay] = useState("");
  const writingPrompt = "In many parts of the world, traditional local cultures are being lost as a result of globalization. What are the main problems associated with this trend, and what measures can be taken to mitigate these issues?";

  // ----------------------------------------------------
  // SPEAKING MODULE LOCAL STATES
  // ----------------------------------------------------
  const [transcript, setTranscript] = useState("");
  const [speakingPrompt, setSpeakingPrompt] = useState("");

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

  useEffect(() => {
    if (!token) return;
    const fetchTest = async <T,>(module: "listening" | "reading"): Promise<T> => {
      const response = await fetch(`${BACKEND_URL}/api/test/${module}/tests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Failed to load ${module} test`);
      if (!Array.isArray(data) || data.length === 0) throw new Error(`No ${module} tests available`);
      return data[0] as T;
    };
    Promise.all([fetchTest<ListeningTest>("listening"), fetchTest<ReadingTest>("reading")])
      .then(([listening, reading]) => {
        setListeningTest(listening);
        setReadingTest(reading);
      })
      .catch((err) => {
        console.error("[Simulator] Failed to load tests:", err);
        setTestsError(errorMessage(err));
      });
  }, [token]);

  // Countdown timer logic
  useEffect(() => {
    if (!isTimerActive || isProcessingStep) return;
    const timer = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [isTimerActive, isProcessingStep]);

  const finishCurrentStepRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (isTimerActive && timeLeft === 0) {
      toast.warning("Time has expired for this module! Submitting automatically...");
      finishCurrentStepRef.current?.();
    }
  }, [isTimerActive, timeLeft]);

  // ----------------------------------------------------
  // TRANSITION & GRADING PIPELINES
  // ----------------------------------------------------
  const goToStep = (next: Step) => {
    const seconds = STEP_SECONDS[next];
    setStep(next);
    setTimeLeft(seconds ?? 0);
    setIsTimerActive(seconds !== undefined);
  };

  const startSimulation = () => {
    goToStep("listening");
  };

  const beginProcessing = () => {
    if (processingRef.current) return false;
    processingRef.current = true;
    setIsProcessingStep(true);
    setIsTimerActive(false);
    return true;
  };

  const endProcessing = () => {
    processingRef.current = false;
    setIsProcessingStep(false);
  };

  const submitObjectiveTest = async (
    module: "listening" | "reading",
    testId: string | undefined,
    answers: Record<number, string>,
  ) => {
    if (!testId) throw new Error(`The ${module} test could not be loaded.`);
    const response = await fetch(`${BACKEND_URL}/api/test/${module}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ test_id: testId, answers }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `${module} scoring failed`);
    if (typeof data?.band_score !== "number") throw new Error("No band score received.");
    return data.band_score as number;
  };

  const handleFinishListening = async () => {
    if (!token || !beginProcessing()) return;
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    try {
      setListeningScore(await submitObjectiveTest("listening", listeningTest?.id, listeningAnswers));
      toast.success("Listening portion recorded.");
    } catch (err) {
      console.error("[Simulator Listening Error]:", err);
      setListeningScore(null);
      toast.error(`Listening could not be graded: ${errorMessage(err)}`);
    } finally {
      goToStep("reading");
      endProcessing();
    }
  };

  const handleFinishReading = async () => {
    if (!token || !beginProcessing()) return;
    try {
      setReadingScore(await submitObjectiveTest("reading", readingTest?.id, readingAnswers));
      toast.success("Reading portion recorded.");
    } catch (err) {
      console.error("[Simulator Reading Error]:", err);
      setReadingScore(null);
      toast.error(`Reading could not be graded: ${errorMessage(err)}`);
    } finally {
      goToStep("writing");
      endProcessing();
    }
  };

  const handleFinishWriting = async () => {
    if (!token || !beginProcessing()) return;
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
      setWritingScore(await streamBandScore(response));
      toast.success("Writing portion evaluated.");
    } catch (err) {
      console.error("[Simulator Writing Evaluation Error]:", err);
      setWritingScore(null);
      toast.error(`Writing could not be graded: ${errorMessage(err)}`);
    } finally {
      goToStep("speaking");
      endProcessing();
    }
  };

  const handleFinishSpeaking = async (transcriptOverride?: string) => {
    if (!token || !beginProcessing()) return;
    const finalTranscript = (transcriptOverride ?? transcript).trim();
    try {
      if (finalTranscript.length < 10) {
        throw new Error("the examiner did not receive enough speech to grade.");
      }
      if (!speakingPrompt) throw new Error("the speaking session was never started.");
      const response = await fetch(`${BACKEND_URL}/api/speaking/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          part: 3,
          prompt: speakingPrompt,
          transcript: finalTranscript,
        }),
      });
      setSpeakingScore(await streamBandScore(response));
      toast.success("Speaking portion graded. Simulation complete!");
    } catch (err) {
      console.error("[Simulator Speaking Evaluation Error]:", err);
      setSpeakingScore(null);
      toast.error(`Speaking could not be graded: ${errorMessage(err)}`);
    } finally {
      goToStep("report");
      endProcessing();
    }
  };

  // Always points at the current step's finish handler so timer expiry never uses stale state
  useEffect(() => {
    finishCurrentStepRef.current =
      step === "listening" ? handleFinishListening
        : step === "reading" ? handleFinishReading
          : step === "writing" ? handleFinishWriting
            : step === "speaking" ? () => handleFinishSpeaking()
              : null;
  });

  const toggleListeningPlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => toast.error("Unable to play the audio."));
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

  const moduleScores = [
    { module: "Listening", score: listeningScore },
    { module: "Reading", score: readingScore },
    { module: "Writing", score: writingScore },
    { module: "Speaking", score: speakingScore },
  ];
  const gradedModules = moduleScores.filter(
    (item): item is { module: string; score: number } => item.score !== null,
  );
  const overallScore =
    gradedModules.length > 0 ? calculateOverallIELTS(gradedModules.map((item) => item.score)) : null;

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

    const cefrLevel = (score: number | null) => {
      if (score === null) return "—";
      if (score >= 8.5) return "C2";
      if (score >= 7.0) return "C1";
      if (score >= 5.5) return "B2";
      if (score >= 4.0) return "B1";
      return "A2";
    };

    const name = escapeHtml(candidateName);
    const overall = overallScore !== null ? overallScore.toFixed(1) : "—";
    const weakest = [...gradedModules].sort((a, b) => a.score - b.score)[0];
    const securityCode = (examAttemptId ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    const ungradedNote =
      gradedModules.length < moduleScores.length
        ? ` Modules marked "Not graded" could not be assessed and are excluded from the overall band.`
        : "";
    const summary = weakest
      ? `Candidate ${name} achieved an overall Band score of ${overall}.${ungradedNote} Based on diagnostic subscores, key improvement areas remain in ${weakest.module} module practice. Prioritizing structured grammar feedback, expanding lexical resource variety, and sitting simulated exams under strict countdown constraints will assist in securing a target score of Band 7.5+.`
      : `No module could be graded in this attempt, so no band score is reported. Please retake the simulation.`;

    const trfHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>IELTS Test Report Form - ${name}</title>
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
                  <span class="font-extrabold text-slate-800 capitalize text-base">${name}</span>
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
                  <span class="font-bold text-blue-900">${cefrLevel(overallScore)}</span>
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
                    <td class="py-4 px-4 font-mono">${formatBand(listeningScore)}</td>
                    <td class="py-4 px-4 border-l border-slate-200 font-mono">${formatBand(readingScore)}</td>
                    <td class="py-4 px-4 border-l border-slate-200 font-mono">${formatBand(writingScore)}</td>
                    <td class="py-4 px-4 border-l border-slate-200 font-mono">${formatBand(speakingScore)}</td>
                    <td class="py-4 px-4 border-l border-slate-200 bg-amber-500/10 text-xl font-black text-blue-950 font-mono">${overall}</td>
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
                ${summary}
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
              <span>Security Code: IELTS-AI-${securityCode}</span>
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

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col justify-between" style={{
      "--scrollbar-thumb": "rgba(100, 116, 139, 0.4)",
      "--scrollbar-track": "rgba(241, 245, 249, 0.5)"
    } as CSSProperties}>
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
                    <CardDescription>
                      {listeningTest?.sections[0]?.instructions ?? "Listen to the audio and answer the questions."}
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground bg-muted border px-2 py-0.5 rounded-sm">Part 1</span>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {listeningTest ? (
                  <>
                    <audio
                      ref={audioRef}
                      src={listeningTest.sections[0]?.audioUrl}
                      onTimeUpdate={() => setAudioProgress(audioRef.current?.currentTime || 0)}
                      onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
                      onEnded={() => setIsPlaying(false)}
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
                        <div className="text-xs font-bold text-primary">{listeningTest.title}</div>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {listeningTest.sections.flatMap((section) => section.questions).map((q) => (
                        <QuestionField
                          key={q.id}
                          question={q}
                          value={listeningAnswers[q.id] || ""}
                          onChange={(value) => setListeningAnswers((prev) => ({ ...prev, [q.id]: value }))}
                          disabled={isProcessingStep}
                          textSizeClass={getTextSizeClass()}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <TestLoadingState error={testsError} />
                )}

                <Button onClick={handleFinishListening} className="w-full h-11" disabled={isProcessingStep || (!listeningTest && !testsError)}>
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
                {readingTest ? (
                  readingTest.passages.map((passage) => (
                    <div key={passage.id} className="space-y-4">
                      <h1 className="text-xl font-bold flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        {passage.title}
                      </h1>
                      <p className={`${getTextSizeClass()} text-foreground/90 leading-relaxed font-sans whitespace-pre-wrap select-text antialiased`}>
                        {passage.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <TestLoadingState error={testsError} />
                )}
              </div>
            </div>

            {/* Right Column: Questions with independent scroll */}
            <div className="w-[480px] md:w-[540px] overflow-y-auto bg-muted/30 px-8 py-8 flex flex-col justify-between shrink-0" style={{
              scrollbarColor: "var(--scrollbar-thumb) var(--scrollbar-track)",
              scrollbarWidth: "thin"
            }}>
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Answer All Questions</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Answer each question based on the passage text.</p>
                </div>

                <div className="space-y-4">
                  {readingTest?.passages.flatMap((passage) => passage.questions).map((q) => (
                    <QuestionField
                      key={q.id}
                      question={q}
                      value={readingAnswers[q.id] || ""}
                      onChange={(value) => setReadingAnswers((prev) => ({ ...prev, [q.id]: value }))}
                      disabled={isProcessingStep}
                      textSizeClass={getTextSizeClass()}
                    />
                  ))}
                </div>
              </div>

              <Button onClick={handleFinishReading} className="w-full h-11 mt-8" disabled={isProcessingStep || (!readingTest && !testsError)}>
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
                  &ldquo;{writingPrompt}&rdquo;
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

        {/* STEP 5: SPEAKING - LIVEKIT AI EXAMINER */}
        {step === "speaking" && token && examAttemptId && (
          <SpeakingLiveKitRoom
            backendUrl={BACKEND_URL}
            authToken={token}
            attemptId={examAttemptId}
            candidateName={candidateName}
            onPromptChange={setSpeakingPrompt}
            onTranscriptChange={setTranscript}
            onComplete={handleFinishSpeaking}
          />
        )}

        {/* STEP 6: CONSOLIDATED REPORT */}
        {step === "report" && (
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
                        {overallScore !== null ? overallScore.toFixed(1) : "—"}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 block">
                        Band
                      </span>
                    </div>
                  </div>
                  <h3 className="font-extrabold text-lg text-foreground">Estimated IELTS Score</h3>
                  <p className="text-xs text-muted-foreground text-center max-w-sm">
                    {overallScore === null
                      ? "No module could be graded in this attempt, so no band score is reported."
                      : gradedModules.length < moduleScores.length
                        ? "Calculated from graded modules only. Modules marked Not graded could not be assessed."
                        : "This represents your mock level. Focus on your weaker subsections in writing/speaking to push this average to 8.0+."}
                  </p>
                </div>

                {/* subscores */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {moduleScores.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-muted/50 bg-background text-center space-y-1.5 shadow-xs">
                      <div className="text-xs font-bold text-muted-foreground">{item.module}</div>
                      <div className="text-xl font-black font-mono text-primary">
                        {item.score !== null ? `Band ${item.score.toFixed(1)}` : "Not graded"}
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
