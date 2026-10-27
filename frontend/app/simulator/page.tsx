"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { readSseEvents } from "@/lib/sse";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell, PageColumn, Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  BandDigits,
  ExamFrame,
  SplitPane,
  SuccessCheck,
  candidateNameFrom,
  passageSize,
  stripPassagePrefix,
  type TextScale,
} from "@/components/exam/exam-frame";
import { QuestionGroups, QuestionNavigator, type ExamQuestion } from "@/components/exam/question-field";
import { AudioPlayer } from "@/components/exam/audio-player";
import { cn } from "@/lib/utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SpeakingLiveKitRoom = dynamic(
  () => import("@/components/simulator/speaking-livekit-room"),
  { ssr: false },
);

type Question = ExamQuestion;

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

const PAPERS: { step: Exclude<Step, "intro" | "report">; name: string }[] = [
  { step: "listening", name: "Listening" },
  { step: "reading", name: "Reading" },
  { step: "writing", name: "Writing" },
  { step: "speaking", name: "Speaking" },
];

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

const cefrLevel = (score: number | null) => {
  if (score === null) return "—";
  if (score >= 8.5) return "C2";
  if (score >= 7.0) return "C1";
  if (score >= 5.5) return "B2";
  if (score >= 4.0) return "B1";
  return "A2";
};

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const countWords = (text: string) => (text.trim() === "" ? 0 : text.trim().split(/\s+/).length);

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

/** The paper could not be fetched: say so, and say what happens if they carry on. */
function TestLoadingState({ error }: { error: string | null }) {
  return error ? (
    <div className="rounded-2xl bg-panel p-5">
      <h2 className="text-[17px] font-semibold text-ink">This paper did not load.</h2>
      <p className="mt-2 text-[15px] leading-normal text-soft">
        {error}. Press Submit to move on; this paper will be marked Not graded.
      </p>
    </div>
  ) : (
    <div className="flex flex-col gap-3" aria-label="Loading the paper">
      <p className="t-shimmer text-[15px]">Loading the paper</p>
      <span className="t-skel block h-5 w-10/12" />
      <span className="t-skel block h-5 w-9/12" />
      <span className="t-skel block h-5 w-7/12" />
    </div>
  );
}

/** Shown over a paper while its answers are being marked. */
function MarkingOverlay({ label }: { label: string }) {
  return (
    <div className="t-rise absolute inset-0 z-10 flex items-center justify-center bg-[rgba(255,255,255,0.86)]">
      <p className="t-shimmer text-[17px] font-medium">{label}</p>
    </div>
  );
}

function IntroRow({ name, what, time }: { name: string; what: ReactNode; time: string }) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-t border-[#e4e0d8] py-4 first:border-t-0 first:pt-0 sm:grid-cols-[120px_1fr_auto]">
      <span className="text-[15px] font-medium text-ink">{name}</span>
      <span className="tabular text-right text-[15px] text-ink sm:order-last">{time}</span>
      <span className="col-span-2 text-[15px] leading-normal text-soft sm:col-span-1">{what}</span>
    </li>
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
  const [fontScale, setFontScale] = useState<TextScale>("base");

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
  const [audioStatus, setAudioStatus] = useState<"loading" | "ready" | "error">("loading");

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
            setCandidateName(candidateNameFrom(session.user));
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

  const weakest = [...gradedModules].sort((a, b) => a.score - b.score)[0];
  const ungraded = moduleScores.filter((item) => item.score === null).map((item) => item.module);
  const testDate = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });

  const handleDownloadTRF = () => {
    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) {
      toast.error("Failed to open print window. Please allow popups for this site.");
      return;
    }

    const name = escapeHtml(candidateName);
    const overall = overallScore !== null ? overallScore.toFixed(1) : "—";
    const securityCode = (examAttemptId ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
    const ungradedNote =
      gradedModules.length < moduleScores.length
        ? ` Modules marked "Not graded" could not be assessed and are excluded from the overall band.`
        : "";
    const summary = weakest
      ? `Candidate ${name} achieved an overall Band score of ${overall}.${ungradedNote} Based on diagnostic subscores, key improvement areas remain in ${weakest.module} module practice. Prioritizing structured grammar feedback, expanding lexical resource variety, and sitting simulated exams under strict countdown constraints will assist in securing a target score of Band 7.5+.`
      : `No module could be graded in this attempt, so no band score is reported. Please retake the simulation.`;

    const cell = (label: string, score: number | null) => `
      <div class="cell">
        <div class="label">${label}</div>
        <div class="${score === null ? "value ungraded" : "value"}">${formatBand(score)}</div>
      </div>`;

    const trfHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Mock Test Report Form - ${name}</title>
          <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&f[]=gambarino@400&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 40px 16px; background: #ebe8e2; color: #0a0a0a;
              font-family: "General Sans", ui-sans-serif, system-ui, sans-serif; font-size: 15px; line-height: 1.5; }
            .bar { max-width: 800px; margin: 0 auto 16px; display: flex; gap: 8px; justify-content: flex-end; }
            .bar button { height: 40px; padding: 0 20px; border: 0; border-radius: 999px; font: inherit; font-weight: 500; cursor: pointer; }
            .primary { background: #256f82; color: #fff; }
            .secondary { background: #ece9e3; color: #0a0a0a; }
            .sheet { max-width: 800px; margin: 0 auto; background: #fff; border: 1px solid #e4e0d8; border-radius: 16px; padding: 40px; }
            .head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding-bottom: 20px; border-bottom: 1px solid #e4e0d8; }
            h1 { font-family: "Gambarino", Georgia, serif; font-weight: 400; font-size: 40px; line-height: 0.92; margin: 0; }
            .soft { color: #5c5852; }
            .details { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 20px 0; border-bottom: 1px solid #e4e0d8; }
            .label { font-size: 13px; color: #5c5852; }
            .scores { display: grid; grid-template-columns: repeat(4, 1fr) 1.4fr; margin-top: 24px; border: 1px solid #e4e0d8; border-radius: 12px; overflow: hidden; }
            .cell { padding: 16px; border-left: 1px solid #e4e0d8; }
            .cell:first-child { border-left: 0; }
            .value { font-size: 32px; font-variant-numeric: tabular-nums; margin-top: 8px; }
            .value.ungraded { font-size: 15px; color: #5c5852; margin-top: 18px; }
            .overall { background: #f5f3ef; }
            .overall .value { font-family: "Gambarino", Georgia, serif; font-size: 64px; line-height: 0.92; }
            .note { margin-top: 24px; padding: 16px; background: #f5f3ef; border-radius: 12px; font-size: 14px; color: #5c5852; }
            .foot { margin-top: 24px; display: flex; justify-content: space-between; gap: 16px; font-size: 13px; color: #5c5852; }
            @media (max-width: 640px) {
              .sheet { padding: 24px; }
              .details, .scores { grid-template-columns: 1fr 1fr; }
              .cell { border-top: 1px solid #e4e0d8; }
              .cell:nth-child(odd) { border-left: 0; }
              .overall { grid-column: span 2; }
            }
            @media print {
              body { background: #fff; padding: 0; }
              .bar { display: none; }
              .sheet { border: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="bar">
            <button class="secondary" onclick="window.close()">Close</button>
            <button class="primary" onclick="window.print()">Save as PDF or print</button>
          </div>
          <div class="sheet">
            <div class="head">
              <h1>Test Report Form</h1>
              <span class="soft">Academic · computer-delivered mock</span>
            </div>
            <div class="details">
              <div><div class="label">Candidate name</div><div>${name}</div></div>
              <div><div class="label">Candidate number</div><div>${candidateId.toUpperCase()}</div></div>
              <div><div class="label">Test date</div><div>${testDate}</div></div>
              <div><div class="label">CEFR level</div><div>${cefrLevel(overallScore)}</div></div>
            </div>
            <div class="scores">
              ${cell("Listening", listeningScore)}
              ${cell("Reading", readingScore)}
              ${cell("Writing", writingScore)}
              ${cell("Speaking", speakingScore)}
              <div class="cell overall">
                <div class="label">Overall band</div>
                <div class="value">${overall}</div>
              </div>
            </div>
            <div class="note">${summary}</div>
            <div class="foot">
              <span>Security code IELTS-AI-${securityCode}</span>
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
      <AppShell title="Full mock test">
        <PageColumn title={<span className="t-shimmer">Preparing your mock test</span>}>
          <div className="t-skel h-[300px] rounded-2xl" aria-hidden />
        </PageColumn>
      </AppShell>
    );
  }

  const textClass = fontScale === "lg" ? "text-[18px]" : fontScale === "sm" ? "text-[15px]" : "text-[16px]";

  // ----------------------------------------------------
  // INTRO
  // ----------------------------------------------------
  if (step === "intro") {
    const listeningCount = listeningTest?.sections.flatMap((s) => s.questions).length;
    const readingCount = readingTest?.passages.flatMap((p) => p.questions).length;
    const paperLine = (count: number | undefined, title: string | undefined, noun: string) =>
      count !== undefined ? (
        <span className="t-revealed">
          {count} questions · {title}
        </span>
      ) : testsError ? (
        <span className="text-bad">Did not load; it will be marked Not graded</span>
      ) : (
        <span className="t-skel inline-block h-4 w-48 align-middle" aria-label={`Loading the ${noun} paper`} />
      );
    return (
      <AppShell title="Full mock test">
        <PageColumn
          title="Four papers, 2 hours 42 minutes."
          lead="Listening, Reading, Writing and Speaking in one sitting, in the order of the real test."
          actions={
            <Button variant="accent" size="lg" onClick={startSimulation}>
              Start the mock
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Panel className="lg:col-span-8" title="The order of the day" aside="Time allowed">
              <ol>
                <IntroRow name="Listening" what={paperLine(listeningCount, listeningTest?.title, "listening")} time="30:00" />
                <IntroRow name="Reading" what={paperLine(readingCount, readingTest?.title, "reading")} time="60:00" />
                <IntroRow name="Writing" what="Task 2 essay, at least 250 words" time="60:00" />
                <IntroRow name="Speaking" what="Live interview with the AI examiner, Parts 1 to 3" time="12:00" />
              </ol>
            </Panel>
            <Panel className="lg:col-span-4" title="Before you start">
              <ul className="flex flex-col gap-2 text-[15px] leading-normal text-soft">
                <li>Each paper has its own clock. At 0:00 it submits and the next paper opens.</li>
                <li>Speaking needs a microphone and camera; your browser will ask when that paper starts.</li>
                <li>A paper that cannot be marked shows as Not graded and stays out of the overall band.</li>
              </ul>
            </Panel>
          </div>
        </PageColumn>
      </AppShell>
    );
  }

  // ----------------------------------------------------
  // REPORT
  // ----------------------------------------------------
  if (step === "report") {
    return (
      <AppShell title="Full mock test">
        <PageColumn
          title={overallScore !== null ? "Your mock test report." : "No paper could be graded."}
          lead={
            overallScore === null
              ? "Nothing was marked in this sitting, so no band is reported. You can sit the mock again."
              : ungraded.length > 0
                ? `${gradedModules.length} of 4 papers graded. ${ungraded.join(" and ")} could not be marked and ${ungraded.length === 1 ? "is" : "are"} left out of the overall band.`
                : `All four papers graded on ${testDate}.`
          }
          actions={
            <>
              <Button variant="secondary" asChild>
                <Link href="/dashboard">Back to home</Link>
              </Button>
              <Button variant="accent" onClick={handleDownloadTRF}>
                Download TRF
              </Button>
            </>
          }
        >
          <Panel
            title="Test report form"
            aside={
              <span className="inline-flex items-center gap-1.5">
                <SuccessCheck />
                Mock complete
              </span>
            }
          >
            <div className="rounded-2xl border border-[#e4e0d8] bg-sheet p-5 sm:p-6">
              <dl className="grid grid-cols-2 gap-4 border-b border-[#e4e0d8] pb-5 md:grid-cols-4">
                <div>
                  <dt className="text-[13px] text-soft">Candidate name</dt>
                  <dd className="mt-0.5 text-[15px] text-ink">{candidateName}</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-soft">Candidate number</dt>
                  <dd className="tabular mt-0.5 text-[15px] text-ink">{candidateId.toUpperCase()}</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-soft">Test date</dt>
                  <dd className="mt-0.5 text-[15px] text-ink">{testDate}</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-soft">CEFR level</dt>
                  <dd className="mt-0.5 text-[15px] text-ink">{cefrLevel(overallScore)}</dd>
                </div>
              </dl>

              <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-[#e4e0d8] md:grid-cols-[repeat(4,1fr)_1.5fr]">
                {moduleScores.map((item, i) => (
                  <div
                    key={item.module}
                    className={cn(
                      "border-[#e4e0d8] p-4",
                      i % 2 === 1 && "border-l",
                      i >= 2 && "border-t md:border-t-0",
                      i > 0 && "md:border-l"
                    )}
                  >
                    <p className="text-[13px] text-soft">{item.module}</p>
                    {item.score !== null ? (
                      <p className="tabular mt-2 text-[40px] leading-none text-ink">{item.score.toFixed(1)}</p>
                    ) : (
                      <p className="mt-4 text-[15px] text-soft">Not graded</p>
                    )}
                  </div>
                ))}
                <div className="col-span-2 border-t border-[#e4e0d8] bg-panel p-4 md:col-span-1 md:border-t-0 md:border-l">
                  <p className="text-[13px] text-soft">Overall band</p>
                  <p className="mt-2 font-display text-[104px] leading-[0.92] text-ink">
                    {overallScore !== null ? <BandDigits value={overallScore.toFixed(1)} /> : "—"}
                  </p>
                </div>
              </div>

              <p className="mt-5 text-[15px] leading-normal text-soft">
                {overallScore === null
                  ? "No paper was marked, so there is no overall band or CEFR level for this sitting."
                  : weakest
                    ? `Weakest paper: ${weakest.module}, Band ${weakest.score.toFixed(1)}. Start your next week of practice there.`
                    : null}
              </p>
            </div>
          </Panel>
        </PageColumn>
      </AppShell>
    );
  }

  // ----------------------------------------------------
  // PAPERS, each in the exam frame
  // ----------------------------------------------------
  const paperIndex = PAPERS.findIndex((p) => p.step === step);
  const paper = PAPERS[paperIndex];
  const listeningQuestions = listeningTest?.sections.flatMap((section) => section.questions) ?? [];
  const readingQuestions = readingTest?.passages.flatMap((passage) => passage.questions) ?? [];
  const unansweredIn = (questions: Question[], answers: Record<number, string>) =>
    questions.filter((q) => (answers[q.id] ?? "").trim() === "").length;
  const words = countWords(essay);

  const submitConfirm =
    step === "listening" && listeningQuestions.length > 0 && unansweredIn(listeningQuestions, listeningAnswers) > 0
      ? `${unansweredIn(listeningQuestions, listeningAnswers)} of ${listeningQuestions.length} listening questions are unanswered and will score zero. Reading opens next.`
      : step === "reading" && readingQuestions.length > 0 && unansweredIn(readingQuestions, readingAnswers) > 0
        ? `${unansweredIn(readingQuestions, readingAnswers)} of ${readingQuestions.length} reading questions are unanswered and will score zero. Writing opens next.`
        : step === "writing"
          ? words < 250
            ? `Your essay is ${words} words. Task 2 asks for at least 250, and short essays lose marks. Speaking opens next.`
            : "Submit your essay? Speaking opens next."
          : step === "speaking"
            ? "This ends the interview and opens your report. If the examiner heard too little, Speaking will be marked Not graded."
            : null;

  const markingLabel =
    step === "listening" ? "Marking your listening answers"
      : step === "reading" ? "Marking your reading answers"
        : step === "writing" ? "Marking your essay"
          : "Marking your speaking";

  return (
    <ExamFrame
      module={paper?.name ?? "Mock test"}
      context={`Full mock · paper ${paperIndex + 1} of 4`}
      candidateName={candidateName}
      timeLeft={timeLeft}
      timerHidden={isTimerHidden}
      onToggleTimer={() => setIsTimerHidden(!isTimerHidden)}
      textScale={step === "speaking" ? undefined : fontScale}
      onTextScale={setFontScale}
      submitLabel={step === "speaking" ? "Finish" : "Submit"}
      submitting={isProcessingStep}
      submitDisabled={(step === "listening" && !listeningTest && !testsError) || (step === "reading" && !readingTest && !testsError)}
      onSubmit={() => finishCurrentStepRef.current?.()}
      submitConfirm={submitConfirm}
      exitBody="Leaving ends this mock. Nothing is saved until the report, so your papers so far will be lost."
      footer={
        step === "listening" && listeningTest ? (
          <QuestionNavigator questions={listeningQuestions} answers={listeningAnswers} />
        ) : step === "reading" && readingTest ? (
          <QuestionNavigator questions={readingQuestions} answers={readingAnswers} />
        ) : undefined
      }
    >
      <div key={step} className="x-stage relative h-full">
        {isProcessingStep && <MarkingOverlay label={markingLabel} />}

        {/* LISTENING */}
        {step === "listening" && (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-[760px] px-5 py-8 sm:px-8 lg:py-12">
              {listeningTest ? (
                <>
                  <audio
                    ref={audioRef}
                    src={listeningTest.sections[0]?.audioUrl}
                    preload="metadata"
                    onTimeUpdate={() => setAudioProgress(audioRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => {
                      setAudioDuration(audioRef.current?.duration || 0);
                      setAudioStatus("ready");
                    }}
                    onEnded={() => setIsPlaying(false)}
                    onError={() => setAudioStatus("error")}
                  />
                  <p className="text-[14px] text-soft">Part {listeningTest.sections[0]?.id ?? 1}</p>
                  <h1 className="mt-1 text-[26px] font-medium leading-tight text-ink">
                    {listeningTest.sections[0]?.instructions ?? "Listen to the audio and answer the questions."}
                  </h1>
                  <div className="mt-6">
                    <AudioPlayer
                      title={listeningTest.title}
                      isPlaying={isPlaying}
                      progress={audioProgress}
                      duration={audioDuration}
                      status={audioStatus}
                      onToggle={toggleListeningPlay}
                      onSeek={(val) => {
                        if (audioRef.current) audioRef.current.currentTime = val;
                        setAudioProgress(val);
                      }}
                      disabled={isProcessingStep}
                    />
                  </div>
                  <div className="mt-10">
                    <QuestionGroups
                      questions={listeningQuestions}
                      answers={listeningAnswers}
                      onAnswer={(id, value) => setListeningAnswers((prev) => ({ ...prev, [id]: value }))}
                      disabled={isProcessingStep}
                      textClass={textClass}
                    />
                  </div>
                </>
              ) : (
                <TestLoadingState error={testsError} />
              )}
            </div>
          </div>
        )}

        {/* READING */}
        {step === "reading" && (
          readingTest ? (
            <SplitPane
              leftLabel="Passage"
              rightLabel="Questions"
              left={
                <article className="mx-auto max-w-[68ch] px-5 py-8 sm:px-10 lg:py-12">
                  {readingTest.passages.map((passage, i) => (
                    <div key={passage.id} className={i > 0 ? "mt-14" : undefined}>
                      <p className="text-[14px] text-soft">Reading passage {passage.id}</p>
                      <h1 className="mt-1 text-[26px] font-medium leading-tight text-ink">{stripPassagePrefix(passage.title)}</h1>
                      <p className={`${passageSize[fontScale]} mt-6 whitespace-pre-wrap leading-[1.7] text-ink select-text`}>
                        {passage.text}
                      </p>
                    </div>
                  ))}
                </article>
              }
              right={
                <div className="mx-auto max-w-[640px] px-5 py-8 sm:px-8 lg:py-12">
                  <h2 className="text-[26px] font-medium leading-tight text-ink">
                    Questions {readingQuestions[0]?.id}–{readingQuestions[readingQuestions.length - 1]?.id}
                  </h2>
                  <p className="mt-1 text-[15px] text-soft">Answer from the passage. Spelling counts on typed answers.</p>
                  <div className="mt-8">
                    <QuestionGroups
                      questions={readingQuestions}
                      answers={readingAnswers}
                      onAnswer={(id, value) => setReadingAnswers((prev) => ({ ...prev, [id]: value }))}
                      disabled={isProcessingStep}
                      textClass={textClass}
                    />
                  </div>
                </div>
              }
            />
          ) : (
            <div className="mx-auto max-w-[760px] px-5 py-8 sm:px-8 lg:py-12">
              <TestLoadingState error={testsError} />
            </div>
          )
        )}

        {/* WRITING */}
        {step === "writing" && (
          <SplitPane
            leftLabel="Task"
            rightLabel="Your essay"
            rightBadge={<span className="tabular text-[13px] text-soft">{words}</span>}
            rightWidth="lg:w-[54%]"
            left={
              <article className="mx-auto max-w-[62ch] px-5 py-8 sm:px-10 lg:py-12">
                <p className="text-[14px] text-soft">Writing Task 2</p>
                <h1 className="mt-1 text-[26px] font-medium leading-tight text-ink">Write about the following topic.</h1>
                <p className={`${passageSize[fontScale]} mt-6 leading-[1.7] text-ink select-text`}>{writingPrompt}</p>
                <p className="mt-6 text-[15px] leading-normal text-soft">
                  Give reasons for your answer and include any relevant examples from your own knowledge or experience.
                  Write at least 250 words. You should spend about 40 minutes on this task.
                </p>
              </article>
            }
            right={
              <div className="flex h-full flex-col px-5 py-6 sm:px-8 lg:py-10">
                <div className="mb-3 flex items-baseline justify-between">
                  <label htmlFor="mock-essay" className="text-[15px] font-semibold text-ink">
                    Your essay
                  </label>
                  <p className="text-[14px] text-soft">
                    <span key={words >= 250 ? "over" : "under"} className={cn("tabular t-swap", words >= 250 ? "text-good" : "text-ink")}>
                      {words}
                    </span>{" "}
                    words · 250 minimum
                  </p>
                </div>
                <Textarea
                  id="mock-essay"
                  placeholder="Start writing here"
                  value={essay}
                  onChange={(e) => setEssay(e.target.value)}
                  className={`${passageSize[fontScale]} min-h-[360px] flex-1 resize-none bg-sheet p-4 leading-[1.7]`}
                  disabled={isProcessingStep}
                  spellCheck={false}
                />
              </div>
            }
          />
        )}

        {/* SPEAKING - LIVEKIT AI EXAMINER */}
        {step === "speaking" && token && examAttemptId && (
          <div className="h-full overflow-y-auto">
            <SpeakingLiveKitRoom
              backendUrl={BACKEND_URL}
              authToken={token}
              attemptId={examAttemptId}
              candidateName={candidateName}
              onPromptChange={setSpeakingPrompt}
              onTranscriptChange={setTranscript}
            />
          </div>
        )}
      </div>
    </ExamFrame>
  );
}
