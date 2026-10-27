"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AppShell, PageColumn, Panel } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import {
  ExamFrame,
  SplitPane,
  candidateNameFrom,
  formatClock,
  passageSize,
  stripPassagePrefix,
  type TextScale,
} from "@/components/exam/exam-frame";
import {
  QuestionGroups,
  QuestionNavigator,
  questionTypeLabel,
  type ExamQuestion,
} from "@/components/exam/question-field";
import { ObjectiveResults, ResultActions, type ObjectiveResult } from "@/components/exam/exam-results";
import { ExamError, ExamLoading, FactRow } from "@/components/exam/exam-states";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Question = ExamQuestion;

interface Passage {
  id: number;
  title: string;
  text: string;
  questions: Question[];
}

interface ReadingTest {
  id: string;
  title: string;
  duration: number;
  passages: Passage[];
}

type ResultData = ObjectiveResult;

function ReadingPageContent() {
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
  const [test, setTest] = useState<ReadingTest | null>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The attempt starts from the intro screen; the clock only runs once started.
  const [started, setStarted] = useState(false);
  const [justMarked, setJustMarked] = useState(false);
  const [pane, setPane] = useState<"left" | "right">("left");

  // Student answer inputs
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Timer states
  const [timeLeft, setTimeLeft] = useState(3600); // 60 mins
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
          toast.error("Please login to access the Reading Module.");
          router.push("/auth/login?redirect=/reading");
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
            .from("reading_attempts")
            .select("*")
            .eq("id", attemptId)
            .single();

          if (attemptErr || !attemptData) {
            throw new Error(attemptErr?.message || "Attempt not found");
          }

          const res = await fetch(`${BACKEND_URL}/api/test/reading/tests`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) throw new Error("Failed to load reading test");
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
          const res = await fetch(`${BACKEND_URL}/api/test/reading/tests`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (!res.ok) throw new Error("Failed to load reading test");
          const data = await res.json();
          if (data && data.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.length);
            setTest(data[randomIndex]);
            setTimeLeft(data[randomIndex].duration * 60);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error(err);
        setLoadError(err.message || "Failed to load reading material.");
        toast.error(err.message || "Failed to load reading material.");
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

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token || !test) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/test/reading/submit`, {
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

      if (!response.ok) throw new Error("Failed to submit reading answers");
      const data = await response.json();
      setResult(data);
      setJustMarked(true);
      window.scrollTo(0, 0);
      toast.success("Reading test graded!");
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
    setPane("left");
    if (test) setTimeLeft(test.duration * 60);
    router.replace("/reading");
  };

  if (isAuthLoading || isLoadingTest) {
    return <ExamLoading shellTitle="Reading" label="Loading your reading test" />;
  }

  if (!test) {
    return (
      <ExamError
        shellTitle="Reading"
        title={loadError ? "The reading test did not load." : "No reading test is available."}
        detail={
          loadError
            ? `${loadError}. Nothing was started and no time was used.`
            : "There are no reading papers on the server yet."
        }
      />
    );
  }

  const questions = test.passages.flatMap((p) => p.questions);
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  const unanswered = questions.length - answeredCount;

  // RESULTS
  if (result) {
    return (
      <AppShell title="Reading">
        <PageColumn
          title={`${result.score} of ${result.total_questions} correct.`}
          lead={test.title}
          actions={<ResultActions onRetry={handleReset} retryLabel="Take it again" />}
        >
          <ObjectiveResults module="Reading" result={result} questions={questions} justMarked={justMarked} />
        </PageColumn>
      </AppShell>
    );
  }

  // INTRO
  if (!started) {
    const byType = (Object.keys(questionTypeLabel) as Question["type"][])
      .map((type) => ({ type, items: questions.filter((q) => q.type === type) }))
      .filter((g) => g.items.length > 0);
    const passages = test.passages.length;
    return (
      <AppShell title="Reading">
        <PageColumn
          title={`${passages === 1 ? "One passage" : `${passages} passages`}, ${questions.length} questions, ${test.duration} minutes.`}
          lead={`${test.title}. The clock starts when you press Start.`}
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
                <li>The passage sits on the left, questions on the right, as in the computer-delivered test.</li>
                <li>Change any answer until you submit. At 0:00 your answers are submitted for you.</li>
                <li>Marking is instant; an AI coach explains any you miss.</li>
              </ul>
            </Panel>
          </div>
        </PageColumn>
      </AppShell>
    );
  }

  // IN TEST
  const firstId = questions[0]?.id;
  const lastId = questions[questions.length - 1]?.id;

  return (
    <ExamFrame
      module="Reading"
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
      exitBody="Your answers on this passage will not be saved or marked."
      footer={
        <QuestionNavigator
          questions={questions}
          answers={answers}
          onJump={() => setPane("right")}
        />
      }
    >
      <SplitPane
        pane={pane}
        onPaneChange={setPane}
        leftLabel="Passage"
        rightLabel="Questions"
        rightBadge={<span className="tabular text-[13px] text-soft">{answeredCount}/{questions.length}</span>}
        left={
          <article className="mx-auto max-w-[68ch] px-5 py-8 sm:px-10 lg:py-12">
            {test.passages.map((passage, i) => (
              <div key={passage.id} className={i > 0 ? "mt-14" : undefined}>
                <p className="text-[14px] text-soft">Reading passage {passage.id}</p>
                <h1 className="mt-1 text-[26px] font-medium leading-tight text-ink">{stripPassagePrefix(passage.title)}</h1>
                <p
                  className={`${passageSize[fontScale]} mt-6 whitespace-pre-wrap leading-[1.7] text-ink select-text`}
                >
                  {passage.text}
                </p>
              </div>
            ))}
          </article>
        }
        right={
          <form
            onSubmit={(e) => e.preventDefault()}
            className="mx-auto max-w-[640px] px-5 py-8 sm:px-8 lg:py-12"
          >
            <h2 className="text-[26px] font-medium leading-tight text-ink">
              Questions {firstId}–{lastId}
            </h2>
            <p className="mt-1 text-[15px] text-soft">Answer from the passage. Spelling counts on typed answers.</p>
            <div className="mt-8">
              <QuestionGroups
                questions={questions}
                answers={answers}
                onAnswer={handleAnswerChange}
                disabled={isSubmitting}
                textClass={fontScale === "lg" ? "text-[18px]" : fontScale === "sm" ? "text-[15px]" : "text-[16px]"}
              />
            </div>
          </form>
        }
      />
    </ExamFrame>
  );
}

export default function ReadingPage() {
  return (
    <Suspense fallback={<ExamLoading shellTitle="Reading" label="Loading your reading test" />}>
      <ReadingPageContent />
    </Suspense>
  );
}
