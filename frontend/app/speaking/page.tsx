"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";
import { readSseEvents } from "@/lib/sse";
import Link from "next/link";
import { Mic, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppShell, PageColumn, Panel } from "@/components/app/app-shell";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ThinkingStatus, stageFromStream } from "@/components/writing/thinking-status";
import { CriteriaTable, NextSteps, OverallBand } from "@/components/writing/band-report";
import { CueCard } from "@/components/speaking/cue-card";
import { cn } from "@/lib/utils";

// Whisper turns silence into a word or two ("Thank you."); anything this short is not an answer to mark.
const MIN_ANSWER_WORDS = 5;
const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SpeakingPartPrompt {
  part: number;
  title: string;
  question: string;
  description: string;
  /** Page heading and plain lead line for this part. */
  heading: string;
  lead: string;
  /** Part 2 only: the cue card laid out as printed. `question` stays the exact text sent to the marker. */
  cue?: { topic: string; bullets: string[]; closing: string };
}

const SPEAKING_PARTS: SpeakingPartPrompt[] = [
  {
    part: 1,
    title: "Part 1: Interview & Warmup",
    question: "Let's talk about your hometown. Describe the town or city where you grew up. Is it a good place for young people to live, and why?",
    description: "You will answer basic personal questions about yourself, your family, or your home.",
    heading: "Part 1, the interview.",
    lead: "Short, natural answers about you and your life. Speak for up to a minute.",
  },
  {
    part: 2,
    title: "Part 2: Individual Long Turn (Cue Card)",
    question: "Describe a piece of technology you own that is very important to you. You should say: what it is, when you got it, how you use it, and explain why it is so important to you.",
    description: "You have 1 minute to prepare notes. Then, you should speak for 1 to 2 minutes on this topic.",
    heading: "Part 2, the long turn.",
    lead: "One minute to prepare, then speak for up to two minutes on the cue card.",
    cue: {
      topic: "Describe a piece of technology you own that is very important to you.",
      bullets: ["what it is", "when you got it", "how you use it"],
      closing: "and explain why it is so important to you.",
    },
  },
  {
    part: 3,
    title: "Part 3: Two-Way Discussion",
    question: "In your opinion, how has modern technology changed the way families spend time together compared to the past? Do you believe these changes are positive or negative?",
    description: "You will answer more abstract, analytical questions developing the topic in Part 2.",
    heading: "Part 3, the discussion.",
    lead: "Bigger questions on the Part 2 topic. Give reasons and examples; up to a minute.",
  }
];

/** Marker stages, keyed by the JSON field the model is writing when it reaches each one. */
const MARKING_STAGES: [string, string][] = [
  ["band_score", "Settling the overall band"],
  ["fluency_coherence", "Scoring fluency and coherence"],
  ["lexical_resource", "Weighing your vocabulary"],
  ["grammatical_range", "Checking grammatical range and accuracy"],
  ["pronunciation", "Estimating pronunciation"],
  ["examiner_comments", "Writing the examiner's comments"],
  ["improvements", "Choosing what to change"],
];
const MARKING_WARMUP = ["Reading your transcript", "Comparing against the band descriptors"];

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
  const [speakError, setSpeakError] = useState<string | null>(null);

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
            setCandidateName(
              (session.user.user_metadata?.full_name as string | undefined) ||
                session.user.email?.split("@")[0] ||
                "Candidate"
            );
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
    setSpeakError(null);

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
      const heard: string = data.transcript || "";
      setTranscript(heard);
      if (countWords(heard) < MIN_ANSWER_WORDS) {
        throw new Error("We could not hear an answer. Check your microphone is on and record again.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to transcribe audio.";
      setSpeakError(message);
      toast.error(message);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Evaluate the transcript using AI Mentor grading criteria
  const handleEvaluate = async () => {
    if (!token) return;
    if (countWords(transcript) < MIN_ANSWER_WORDS) {
      toast.error("Record an answer of at least a sentence before marking.");
      return;
    }

    setIsGrading(true);
    setResult(null);
    setStreamingText("");
    setSpeakError(null);

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
      const message = err instanceof Error ? err.message : "Failed to grade speaking attempt.";
      setSpeakError(message);
      toast.error(message);
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
      setSpeakError(null);
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

  // Choosing a part directly clears the current attempt, the same way advancing does.
  const handleSelectPart = (idx: number) => {
    setCurrentPartIdx(idx);
    setTranscript("");
    setResult(null);
    setNotepadText("");
    setSpeakError(null);
  };

  if (isAuthLoading) return <SpeakingSkeleton />;

  const partOptions = SPEAKING_PARTS.map((p, idx) => ({ value: String(idx), label: `Part ${p.part}` }));
  const limitSeconds = currentPart.part === 2 ? 120 : 60;
  const transcriptWords = countWords(transcript);
  const busy = isRecording || isPrepping || isTranscribing || isGrading;

  /* ---------- Result: the band, the four criteria, then the examiner's comments ---------- */
  if (result) {
    const isLast = currentPartIdx >= SPEAKING_PARTS.length - 1;
    return (
      <AppShell title="Speaking">
        <PageColumn
          title={`Part ${currentPart.part}, marked.`}
          lead={
            isLast
              ? `${transcriptWords} words in your answer. That was the last part of the speaking test.`
              : `${transcriptWords} words in your answer, ${result.improvements.length} ${result.improvements.length === 1 ? "thing" : "things"} to change before Part ${currentPart.part + 1}.`
          }
          actions={
            <>
              <Button onClick={() => setResult(null)} variant="secondary">
                Try this part again
              </Button>
              {isLast ? (
                <Button asChild variant="accent">
                  <Link href="/dashboard">Back to home</Link>
                </Button>
              ) : (
                <Button onClick={handleNextPart} variant="accent">
                  Go on to Part {currentPart.part + 1}
                </Button>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start">
            <div className="contents lg:col-span-3 lg:flex lg:flex-col lg:gap-4">
              <div className="order-1 lg:order-none">
                <OverallBand band={result.band_score} caption={`Speaking Part ${currentPart.part}. Pronunciation is estimated from your transcript.`} />
              </div>
              <div className="order-3 lg:order-none">
                <Panel title="What to change">
                  <NextSteps items={result.improvements} empty="The examiner gave no specific changes for this answer." />
                </Panel>
              </div>
            </div>
            <div className="contents lg:col-span-9 lg:flex lg:flex-col lg:gap-4">
              <div className="order-2 lg:order-none">
                <CriteriaTable
                  aside="Out of 9"
                  rows={[
                    { label: "Fluency and coherence", band: result.fluency_coherence },
                    { label: "Lexical resource", band: result.lexical_resource },
                    { label: "Grammatical range and accuracy", band: result.grammatical_range },
                    { label: "Pronunciation", band: result.pronunciation },
                  ]}
                />
              </div>
              <div className="order-4 lg:order-none">
                <Panel title="Examiner comments">
                  {result.examiner_comments ? (
                    <p className="max-w-[70ch] whitespace-pre-wrap text-[17px] leading-[1.7] text-ink">{result.examiner_comments}</p>
                  ) : (
                    <p className="text-[15px] text-soft">The examiner left no comments on this answer.</p>
                  )}
                </Panel>
              </div>
              <section className="order-5 rounded-2xl border border-border bg-sheet p-5 sm:p-8 lg:order-none">
                <h2 className="text-[15px] font-semibold text-ink">What you said</h2>
                <p className="mt-1 mb-5 text-sm text-soft">{currentPart.cue ? currentPart.cue.topic : currentPart.question}</p>
                {transcript ? (
                  <p className="max-w-[70ch] whitespace-pre-wrap text-[17px] leading-[1.75] text-ink select-text">{transcript}</p>
                ) : (
                  <p className="text-[15px] text-soft">—</p>
                )}
              </section>
            </div>
          </div>
        </PageColumn>
      </AppShell>
    );
  }

  /* ---------- Practice: the question on the left, the recorder on the right ---------- */
  const phase = isGrading
    ? "marking"
    : isTranscribing
      ? "transcribing"
      : isRecording
        ? "recording"
        : isPrepping
          ? "preparing"
          : transcript
            ? "recorded"
            : "idle";

  const phaseLabel = {
    idle: "Ready when you are",
    preparing: "Preparation",
    recording: "Recording",
    transcribing: "Transcribing",
    recorded: "Recorded",
    marking: "Marking",
  }[phase];

  const bigFigure =
    phase === "preparing"
      ? getTimerString(prepSeconds)
      : phase === "idle"
        ? getTimerString(currentPart.part === 2 ? 60 : 0)
        : getTimerString(recordingSeconds);

  const bigCaption = {
    idle: currentPart.part === 2 ? "to prepare, then up to 2:00 to speak" : `Up to ${getTimerString(limitSeconds)}. Recording stops on its own.`,
    preparing: "left to prepare. Recording starts by itself.",
    recording: `of ${getTimerString(limitSeconds)}`,
    transcribing: "recorded",
    recorded: `recorded, ${transcriptWords} words transcribed`,
    marking: `recorded, ${transcriptWords} words`,
  }[phase];

  const marking = stageFromStream(streamingText, MARKING_STAGES, MARKING_WARMUP);

  return (
    <AppShell title="Speaking">
      <PageColumn
        title={currentPart.heading}
        lead={currentPart.lead}
        actions={
          <SegmentedControl
            label="Speaking part"
            value={String(currentPartIdx)}
            disabled={busy}
            onChange={(v) => handleSelectPart(Number(v))}
            options={partOptions}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
          {/* The question, as the examiner gives it */}
          <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-4">
            <div key={currentPartIdx} className="t-swap order-1 lg:order-none">
              {currentPart.cue ? (
                <CueCard {...currentPart.cue} />
              ) : (
                <section className="rounded-2xl border border-border bg-sheet p-6 sm:p-8">
                  <p className="mb-5 text-sm text-soft">The examiner asks</p>
                  <p className="text-[22px] leading-snug font-medium text-ink sm:text-[24px]">{currentPart.question}</p>
                </section>
              )}
            </div>

            <div className="order-2 flex flex-wrap items-center gap-3 px-1 lg:order-none">
              <Button onClick={speakQuestion} variant="secondary" size="sm" disabled={isSpeakingPrompt}>
                <Volume2 />
                {isSpeakingPrompt ? <span className="t-shimmer">Examiner speaking</span> : "Hear the question"}
              </Button>
              <p className="text-sm text-soft">Listen first, as you would in the test room.</p>
            </div>

            {currentPart.part === 2 && (
              <Panel title="Your notes" aside="Not marked" className="order-4 lg:order-none">
                <label htmlFor="cue-notes" className="sr-only">
                  Notes for the cue card
                </label>
                <Textarea
                  id="cue-notes"
                  placeholder="A few words for each point on the card"
                  value={notepadText}
                  onChange={(e) => setNotepadText(e.target.value)}
                  className="min-h-[112px] text-[17px]"
                />
              </Panel>
            )}

            <Panel className="order-5 lg:order-none" title="Your transcript" aside={transcript && !isTranscribing ? `${transcriptWords} words` : undefined}>
              {isTranscribing ? (
                <div className="flex flex-col gap-2.5 py-1" aria-busy>
                  <div className="t-skel h-4 w-full" />
                  <div className="t-skel h-4 w-11/12" />
                  <div className="t-skel h-4 w-2/3" />
                </div>
              ) : transcript ? (
                <p className="t-revealed max-w-[70ch] text-[17px] leading-[1.7] text-ink">{transcript}</p>
              ) : (
                <p className="text-[15px] leading-relaxed text-soft">Your words appear here after you stop recording.</p>
              )}
            </Panel>
          </div>

          {/* The recorder: one figure, one state, one action */}
          <section
            aria-label="Recorder"
            className="order-3 flex flex-col rounded-2xl bg-panel p-5 sm:p-6 lg:sticky lg:order-none lg:top-6 lg:col-span-5 lg:min-h-[420px]"
          >
            <div className="flex items-center gap-2.5">
              {(phase === "recording" || phase === "preparing") && (
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 rounded-full motion-reduce:animate-none",
                    phase === "recording" ? "animate-pulse bg-brand" : "bg-ink"
                  )}
                />
              )}
              <h2 key={phase} className="t-swap text-[15px] font-semibold text-ink">
                {phaseLabel}
              </h2>
            </div>

            <div className="mt-8 mb-6">
              <p
                className={cn(
                  "tabular text-[72px] leading-none text-ink sm:text-[88px]",
                  (phase === "idle" || phase === "transcribing" || phase === "marking") && "text-soft"
                )}
                aria-live={phase === "recording" || phase === "preparing" ? "off" : undefined}
              >
                {bigFigure}
              </p>
              <p className="mt-3 text-[15px] text-soft">{bigCaption}</p>
              {phase === "recording" && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel-strong" aria-hidden>
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                    style={{ width: `${Math.min(1, recordingSeconds / limitSeconds) * 100}%` }}
                  />
                </div>
              )}
              {phase === "preparing" && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel-strong" aria-hidden>
                  <div
                    className="h-full rounded-full bg-ink transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                    style={{ width: `${((60 - prepSeconds) / 60) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {(phase === "transcribing" || phase === "marking") && (
              <p className="mb-6 text-[17px]">
                {phase === "transcribing" ? (
                  <ThinkingStatus states={["Transcribing your answer", "Turning speech into text"]} />
                ) : (
                  <ThinkingStatus states={marking} />
                )}
              </p>
            )}

            {speakError && phase !== "marking" && phase !== "transcribing" && (
              <div role="alert" className="t-rise mb-5 rounded-xl bg-bad-tint p-4 text-[15px] leading-relaxed">
                <p className="font-medium text-bad">That did not go through.</p>
                <p className="mt-1 text-ink">{speakError} Wait a minute and try again.</p>
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2.5">
              {phase === "idle" &&
                (currentPart.part === 2 ? (
                  <>
                    <Button onClick={startPrepTimer} variant="accent" size="lg">
                      Start 1:00 preparation
                    </Button>
                    <Button onClick={startRecording} variant="secondary" size="lg">
                      <Mic /> Skip and speak now
                    </Button>
                  </>
                ) : (
                  <Button onClick={startRecording} variant="accent" size="lg">
                    <Mic /> Start recording
                  </Button>
                ))}
              {phase === "preparing" && (
                <Button onClick={startRecording} variant="accent" size="lg">
                  <Mic /> Start speaking now
                </Button>
              )}
              {phase === "recording" && (
                <Button onClick={stopRecording} variant="default" size="lg">
                  <Square className="fill-current" /> Stop recording
                </Button>
              )}
              {phase === "recorded" && (
                <>
                  <Button onClick={handleEvaluate} variant="accent" size="lg">
                    {speakError ? "Mark it again" : "Mark my answer"}
                  </Button>
                  <Button onClick={handleReset} variant="ghost" size="lg">
                    Record again
                  </Button>
                </>
              )}
            </div>

            <div className="mt-6 border-t border-border pt-4">
              {cameraStream && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  aria-label={`Camera preview for ${candidateName}`}
                  className="mb-3 aspect-video w-full rounded-xl bg-ink object-cover"
                />
              )}
              <button
                type="button"
                onClick={toggleCamera}
                className="text-sm text-soft underline decoration-1 underline-offset-4 hover:text-ink hover:decoration-2"
              >
                {cameraStream ? "Turn camera preview off" : "Practise on camera (preview only, not recorded)"}
              </button>
            </div>
          </section>
        </div>
      </PageColumn>
    </AppShell>
  );
}

function SpeakingSkeleton() {
  return (
    <AppShell title="Speaking">
      <PageColumn title="Speaking" lead="Getting the examiner ready.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" aria-busy>
          <div className="t-skel h-[300px] rounded-2xl lg:col-span-7" />
          <div className="t-skel h-[420px] rounded-2xl lg:col-span-5" />
        </div>
      </PageColumn>
    </AppShell>
  );
}

export default function SpeakingPage() {
  return (
    <Suspense fallback={<SpeakingSkeleton />}>
      <SpeakingPageContent />
    </Suspense>
  );
}
