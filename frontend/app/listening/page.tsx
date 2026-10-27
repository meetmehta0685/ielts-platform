"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle, Clock, AlertCircle, Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Question {
  id: number;
  type: "multiple-choice" | "true-false-not-given" | "fill-gap";
  questionText: string;
  options?: string[];
}

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

interface GradingDetail {
  correct: boolean;
  correctAnswer: string;
  submittedAnswer: string;
}

interface ResultData {
  score: number;
  total_questions: number;
  band_score: number;
  details: Record<number, GradingDetail>;
  explanations: Record<number, string>;
}

function ListeningPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Candidate Details
  const [candidateName, setCandidateName] = useState("Candidate");
  const [candidateId, setCandidateId] = useState("ielts-candidate");

  // CBT Configuration States
  const [isTimerHidden, setIsTimerHidden] = useState(false);
  const [fontScale, setFontScale] = useState<"sm" | "base" | "lg">("base");

  // Test data states
  const [test, setTest] = useState<ListeningTest | null>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(true);

  // Student answer inputs
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Audio HTML5 element hooks
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);

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

  // Load test data
  useEffect(() => {
    if (!token) return;

    const fetchTest = async () => {
      try {
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
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to load listening test materials.");
      } finally {
        setIsLoadingTest(false);
      }
    };

    fetchTest();
  }, [token, searchParams]);

  // Start countdown timer
  useEffect(() => {
    if (!test || result || isSubmitting || timeLeft <= 0) return;
    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
      if (timeLeft <= 1) submitRef.current(); // Auto-submit when time expires
    }, 1000);
    return () => clearTimeout(timer);
  }, [test, result, isSubmitting, timeLeft]);

  // Handle HTML5 audio controls
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    setAudioProgress(audioRef.current.currentTime);
  };

  const handleAudioLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const value = parseFloat(e.target.value);
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
      toast.success("Listening test graded!");
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
    setIsPlaying(false);
    setAudioProgress(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    if (test) setTimeLeft(test.duration * 60);
    router.replace("/listening");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (isAuthLoading || isLoadingTest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading listening module...</p>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <p className="text-sm text-muted-foreground">No active listening test found.</p>
        </div>
      </div>
    );
  }

  const section = test.sections[0];

  const getTextSizeClass = () => {
    if (fontScale === "sm") return "text-xs";
    if (fontScale === "lg") return "text-base";
    return "text-sm";
  };

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-muted/50 bg-[#333f48] text-white px-6 h-16 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 mr-1 text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </a>
          <span className="font-bold tracking-tight text-white">IELTS CBT Practice - Listening</span>
        </div>

        {/* Center: CBT Enforced Timer */}
        {!result && (
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
        )}

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

      {/* Main Container */}
      <main className="flex-1 mx-auto max-w-4xl w-full px-4 py-8 space-y-6">
        {/* HTML5 Hidden Audio Tag */}
        <audio
          ref={audioRef}
          src={section.audioUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onLoadedMetadata={handleAudioLoadedMetadata}
        />

        {/* 1. Audio Control Card */}
        <Card className="shadow-md border-muted/50 overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-primary" />
              Audio Lecture Player
            </CardTitle>
            <CardDescription>{test.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {/* Play Pause button */}
              <Button
                onClick={togglePlay}
                size="icon"
                className="h-12 w-12 rounded-full shadow-md shadow-primary/10 shrink-0"
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
              </Button>

              {/* Progress Slider */}
              <div className="flex-1 space-y-1">
                <input
                  type="range"
                  min="0"
                  max={audioDuration || 100}
                  value={audioProgress}
                  onChange={handleProgressChange}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>{formatTime(audioProgress)}</span>
                  <span>{formatTime(audioDuration)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Questions form or Grading Report */}
        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <h2 className={`font-bold ${fontScale === "sm" ? "text-sm" : fontScale === "lg" ? "text-lg" : "text-base"}`}>{section.instructions}</h2>
                <p className="text-xs text-muted-foreground">Ensure spelling and numerical formatting is correct.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.questions.map((q) => (
                  <div key={q.id} className="bg-background rounded-xl p-4 border border-muted/50 space-y-3 shadow-xs">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-xs text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-md">
                        {q.id}
                      </span>
                      <p className={`${getTextSizeClass()} font-semibold text-foreground leading-normal`}>{q.questionText}</p>
                    </div>

                    {q.type === "multiple-choice" && (
                      <div className="flex flex-col gap-1.5 pt-1">
                        {q.options?.map((opt) => {
                          const choiceLetter = opt.charAt(0);
                          const isSelected = answers[q.id] === choiceLetter;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleAnswerChange(q.id, choiceLetter)}
                              className={`text-left text-xs p-2.5 rounded-lg border transition-all cursor-pointer ${
                                isSelected 
                                  ? "bg-primary/5 border-primary text-primary font-bold" 
                                  : "bg-background border-muted hover:border-primary/20 hover:bg-muted"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === "true-false-not-given" && (
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        {["TRUE", "FALSE", "NOT GIVEN"].map((opt) => {
                          const isSelected = answers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleAnswerChange(q.id, opt)}
                              className={`px-3 py-2 rounded-lg border font-bold transition-all cursor-pointer ${
                                isSelected 
                                  ? "bg-primary text-primary-foreground border-primary" 
                                  : "bg-background border-border text-foreground hover:bg-muted"
                                }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === "fill-gap" && (
                      <Input
                        placeholder="Type word or digits here..."
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        className="h-9 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Grading answers...
                </>
              ) : (
                "Submit Listening Answers"
              )}
            </Button>
          </form>
        ) : (
          // Grading report display
          <div className="space-y-6 animate-message-appear">
            {/* Overall Score */}
            <Card className="shadow-md border-muted/50">
              <CardHeader className="pb-3 text-center">
                <CardTitle className="text-base font-bold">Listening Score Summary</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-500/20 bg-emerald-500/5">
                  <div className="text-center">
                    <span className="text-2xl font-black text-emerald-600 font-mono block leading-none">
                      {result.score}/{result.total_questions}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5 block">
                      Correct
                    </span>
                  </div>
                </div>
                <div className="text-center space-y-0.5">
                  <div className="text-lg font-black text-foreground font-mono">
                    Band {result.band_score.toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground">Estimated IELTS Listening Level</p>
                </div>
              </CardContent>
            </Card>

            {/* Questions Review list */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">Review Answers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.questions.map((q) => {
                  const detail = result.details[q.id];
                  const explanation = result.explanations[q.id];
                  const isCorrect = detail?.correct;

                  return (
                    <div 
                      key={q.id} 
                      className={`rounded-xl p-4 border text-xs space-y-2 shadow-xs ${
                        isCorrect 
                          ? "bg-emerald-50/20 border-emerald-100" 
                          : "bg-rose-50/20 border-rose-100"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold font-mono text-primary">Question {q.id}</span>
                        <span className={`font-bold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider ${
                          isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      </div>
                      <p className="font-semibold text-foreground leading-normal">{q.questionText}</p>
                      <div className="flex flex-col gap-1 text-[11px] pt-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Your Answer:</span>
                          <span className={`font-bold ${isCorrect ? "text-emerald-600" : "text-rose-600"}`}>
                            {detail?.submittedAnswer || "(Blank)"}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div className="flex justify-between border-t border-muted/20 pt-1 mt-1">
                            <span className="text-muted-foreground">Correct Answer:</span>
                            <span className="font-bold text-emerald-600">
                              {detail?.correctAnswer}
                            </span>
                          </div>
                        )}
                      </div>
                      {!isCorrect && explanation && (
                        <div className="bg-background/80 border border-muted/50 p-2.5 rounded-lg text-[10px] text-muted-foreground leading-relaxed mt-2 italic">
                          <strong>AI explanation:</strong> {explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Button onClick={handleReset} variant="outline" className="w-full">
              Restart Practice Test
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ListeningPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading listening module...</p>
          </div>
        </div>
      }
    >
      <ListeningPageContent />
    </Suspense>
  );
}
