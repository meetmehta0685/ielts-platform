"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AppShell, PageColumn, Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { ExamFrame, candidateNameFrom, formatClock, type TextScale } from "@/components/exam/exam-frame";
import {
  QuestionGroups,
  QuestionNavigator,
  questionTypeLabel,
  type ExamQuestion,
} from "@/components/exam/question-field";
import { ObjectiveResults, ResultActions, type ObjectiveResult } from "@/components/exam/exam-results";
import { ExamError, ExamLoading, FactRow } from "@/components/exam/exam-states";
import { AudioPlayer } from "@/components/exam/audio-player";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Question = ExamQuestion;

interface Section {
  id: number;
  audioUrl: string;
  instructions: string;
  questions: Question[];
}

interface ListeningTest {
  id: string;
  title: string;
  duration: number;
  sections: Section[];
}

type ResultData = ObjectiveResult;

function ListeningPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Candidate Details
  const [candidateName, setCandidateName] = useState("Candidate");

  // CBT Configuration States
  const [isTimerHidden, setIsTimerHidden] = useState(false);
  const [fontScale, setFontScale] = useState<TextScale>("base");

  // Test data states
  const [test, setTest] = useState<ListeningTest | null>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The attempt starts from the intro screen; the clock only runs once started.
  const [started, setStarted] = useState(false);
  const [justMarked, setJustMarked] = useState(false);

  // Student answer inputs
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Audio HTML5 element hooks
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioStatus, setAudioStatus] = useState<"loading" | "ready" | "error">("loading");

  // Timer states
  const [timeLeft, setTimeLeft] = useState(1800); // 30 mins
  const submitRef = useRef<() => void>(() => {});

  // Grading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);

  // Sync token
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          toast.error("Please login to access the Listening Module.");
          router.push("/auth/login?redirect=/listening");
        } else {
          setToken(session.access_token);
          if (session.user) setCandidateName(candidateNameFrom(session.user));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsAuthLoading(false);
      }
    };
    fetchSession();
  }, [router]);

  // Load test data
  useEffect(() => {
    if (!token) return;

    const fetchTest = async () => {
      try {
        setLoadError(null);
        const attemptId = searchParams.get("attempt_id");
        if (attemptId) {
          const { data: attemptData, error: attemptErr } = await supabase
            .from("listening_attempts")
            .select("*")
            .eq("id", attemptId)
            .single();

          if (attemptErr || !attemptData) {
            throw new Error(attemptErr?.message || "Attempt not found");
          }

          const res = await fetch(`${BACKEND_URL}/api/test/listening/tests`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) throw new Error("Failed to load listening test");
          const tests = await res.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const matchedTest = tests.find((t: any) => t.title === attemptData.test_title) || tests[0];

          if (matchedTest) {
            setTest(matchedTest);
            setResult({
              score: attemptData.score,
              total_questions: attemptData.total_questions,
              band_score: Number(attemptData.band_score),
              details: attemptData.answers_json,
              explanations: attemptData.explanations_json,
            });
            const initialAnswers: Record<number, string> = {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.entries(attemptData.answers_json || {}).forEach(([qId, detail]: [string, any]) => {
              initialAnswers[Number(qId)] = detail.submittedAnswer || "";
            });
            setAnswers(initialAnswers);
          }
        } else {
          const res = await fetch(`${BACKEND_URL}/api/test/listening/tests`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) throw new Error("Failed to load listening test");
          const data = await res.json();
          if (data && data.length > 0) {
            setTest(data[0]);
            setTimeLeft(data[0].duration * 60);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error(err);
        setLoadError(err.message || "Failed to load listening test materials.");
        toast.error(err.message || "Failed to load listening test materials.");
      } finally {
        setIsLoadingTest(false);
      }
    };

    fetchTest();
  }, [token, searchParams]);

  // Start countdown timer (only once the candidate has pressed Start)
  useEffect(() => {
    if (!started || !test || result || isSubmitting || timeLeft <= 0) return;
    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
      if (timeLeft <= 1) submitRef.current(); // Auto-submit when time expires
    }, 1000);
    return () => clearTimeout(timer);
  }, [started, test, result, isSubmitting, timeLeft]);

  // Handle HTML5 audio controls
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => toast.error("Unable to play the audio."));
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    setAudioProgress(audioRef.current.currentTime);
  };

  const handleAudioLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
    setAudioStatus("ready");
  };

  const handleProgressChange = (value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setAudioProgress(value);
  };

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token || !test) return;

    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/test/listening/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          test_id: test.id,
          answers,
        }),
      });

      if (!response.ok) throw new Error("Failed to grade listening answers");
      const data = await response.json();
      setResult(data);
      setJustMarked(true);
      window.scrollTo(0, 0);
      toast.success("Listening test graded!");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.message || "Failed to grade answers.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    submitRef.current = handleSubmit;
  });

  const handleReset = () => {
    setAnswers({});
    setResult(null);
    setStarted(false);
    setJustMarked(false);
    setIsPlaying(false);
    setAudioProgress(0);
    setAudioStatus("loading");
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    if (test) setTimeLeft(test.duration * 60);
    router.replace("/listening");
  };

  if (isAuthLoading || isLoadingTest) {
    return <ExamLoading shellTitle="Listening" label="Loading your listening test" />;
  }

  if (!test) {
    return (
      <ExamError
        shellTitle="Listening"
        title={loadError ? "The listening test did not load." : "No listening test is available."}
        detail={
          loadError
            ? `${loadError}. Nothing was started and no time was used.`
            : "There are no listening papers on the server yet."
        }
      />
    );
  }

  const section = test.sections[0];
  const questions = test.sections.flatMap((s) => s.questions);
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  const unanswered = questions.length - answeredCount;
  const textClass = fontScale === "lg" ? "text-[18px]" : fontScale === "sm" ? "text-[15px]" : "text-[16px]";

  // RESULTS
  if (result) {
    return (
      <AppShell title="Listening">
        <PageColumn
          title={`${result.score} of ${result.total_questions} correct.`}
          lead={test.title}
          actions={<ResultActions onRetry={handleReset} retryLabel="Take it again" />}
        >
          <ObjectiveResults module="Listening" result={result} questions={questions} justMarked={justMarked} />
        </PageColumn>
      </AppShell>
    );
  }

  // INTRO
  if (!started) {
    const byType = (Object.keys(questionTypeLabel) as Question["type"][])
      .map((type) => ({ type, items: questions.filter((q) => q.type === type) }))
      .filter((g) => g.items.length > 0);
    const sections = test.sections.length;
    return (
      <AppShell title="Listening">
        <PageColumn
          title={`${sections === 1 ? "One recording" : `${sections} recordings`}, ${questions.length} questions, ${test.duration} minutes.`}
          lead={`${test.title}. Have headphones on; the clock starts when you press Start.`}
          actions={
            <Button variant="accent" size="lg" onClick={() => setStarted(true)}>
              Start the test
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Panel className="lg:col-span-8" title="What you will answer" aside={`${questions.length} questions`}>
              {byType.map((g) => (
                <FactRow
                  key={g.type}
                  label={questionTypeLabel[g.type]}
                  note={`Question${g.items.length > 1 ? "s" : ""} ${g.items.map((q) => q.id).join(", ")}`}
                  value={g.items.length}
                />
              ))}
            </Panel>
            <Panel className="lg:col-span-4" title="Time allowed">
              <p className="tabular text-[48px] leading-none text-ink">{formatClock(test.duration * 60)}</p>
              <ul className="mt-5 flex flex-col gap-2 text-[15px] leading-normal text-soft">
                <li>In the real test the recording plays once, with no pausing. Here you can pause and scrub back.</li>
                <li>Read the questions before you press play, and answer as you listen.</li>
                <li>At 0:00 your answers are submitted for you.</li>
              </ul>
            </Panel>
          </div>
        </PageColumn>
      </AppShell>
    );
  }

  // IN TEST
  return (
    <ExamFrame
      module="Listening"
      context={test.title}
      candidateName={candidateName}
      timeLeft={timeLeft}
      timerHidden={isTimerHidden}
      onToggleTimer={() => setIsTimerHidden(!isTimerHidden)}
      textScale={fontScale}
      onTextScale={setFontScale}
      submitting={isSubmitting}
      onSubmit={() => handleSubmit()}
      submitConfirm={
        unanswered > 0
          ? `${unanswered} of ${questions.length} questions ${unanswered === 1 ? "is" : "are"} unanswered and will score zero.`
          : null
      }
      exitBody="Your answers on this recording will not be saved or marked."
      footer={<QuestionNavigator questions={questions} answers={answers} />}
    >
      <div className="h-full overflow-y-auto">
        <audio
          ref={audioRef}
          src={section.audioUrl}
          preload="metadata"
          onTimeUpdate={handleAudioTimeUpdate}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onError={() => setAudioStatus("error")}
        />
        <form onSubmit={(e) => e.preventDefault()} className="mx-auto max-w-[760px] px-5 py-8 sm:px-8 lg:py-12">
          <p className="text-[14px] text-soft">Part {section.id}</p>
          <h1 className="mt-1 text-[26px] font-medium leading-tight text-ink">{section.instructions}</h1>
          <div className="mt-6">
            <AudioPlayer
              title={`Part ${section.id} recording`}
              isPlaying={isPlaying}
              progress={audioProgress}
              duration={audioDuration}
              status={audioStatus}
              onToggle={togglePlay}
              onSeek={handleProgressChange}
              disabled={isSubmitting}
            />
          </div>
          <p className="mt-3 text-[14px] text-soft">Check spelling and write numbers as digits.</p>
          <div className="mt-10">
            <QuestionGroups
              questions={questions}
              answers={answers}
              onAnswer={handleAnswerChange}
              disabled={isSubmitting}
              textClass={textClass}
            />
          </div>
        </form>
      </div>
    </ExamFrame>
  );
}

export default function ListeningPage() {
  return (
    <Suspense fallback={<ExamLoading shellTitle="Listening" label="Loading your listening test" />}>
      <ListeningPageContent />
    </Suspense>
  );
}
