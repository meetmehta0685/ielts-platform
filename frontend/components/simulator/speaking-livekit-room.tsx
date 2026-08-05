"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import {
  RoomEvent,
  Track,
  type Participant,
  type TranscriptionSegment,
} from "livekit-client";
import {
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type RoomDetails = {
  roomName: string;
  participantIdentity: string;
  agentIdentity: string;
  agentName: string;
  agentDispatchError?: string | null;
  serverUrl: string;
  token: string;
};

type TranscriptLine = {
  id: string;
  text: string;
  speaker: "candidate" | "examiner";
  final: boolean;
  startTime: number;
};

export interface SpeakingLiveKitRoomProps {
  backendUrl: string;
  authToken: string;
  attemptId: string;
  candidateName: string;
  prompt: string;
  onTranscriptChange: (transcript: string) => void;
  onComplete: (transcript: string) => void | Promise<void>;
}

export default function SpeakingLiveKitRoom({
  backendUrl,
  authToken,
  attemptId,
  candidateName,
  prompt,
  onTranscriptChange,
  onComplete,
}: SpeakingLiveKitRoomProps) {
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const createRoom = async () => {
      try {
        setRequestError(null);
        const response = await fetch(`${backendUrl}/api/simulator/speaking/session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            attempt_id: attemptId,
            candidate_name: candidateName,
          }),
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const serverError = typeof data.error === "string" ? data.error : "";
          const isLiveKitConfigurationError =
            data.code === "LIVEKIT_NOT_CONFIGURED" || /livekit is not configured/i.test(serverError);

          throw new Error(
            isLiveKitConfigurationError
              ? "The AI examiner is temporarily unavailable. Please try again later."
              : serverError || "Unable to create the AI speaking room.",
          );
        }

        setDetails(data as RoomDetails);
      } catch (error: unknown) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          const message = error instanceof Error ? error.message : "Unable to create the AI speaking room.";
          setRequestError(message);
        }
      } finally {
        setIsRetrying(false);
      }
    };

    createRoom();
    return () => controller.abort();
  }, [attemptId, authToken, backendUrl, candidateName, retryNonce]);

  if (requestError) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md space-y-4 text-center text-white">
          <WifiOff className="mx-auto h-10 w-10 text-rose-400" />
          <h2 className="text-xl font-bold">Unable to open the AI examiner room</h2>
          <p className="text-sm text-slate-300">{requestError}</p>
          <p className="text-xs text-slate-500">
            Confirm the backend is running and the LiveKit credentials are configured.
          </p>
          <Button
            type="button"
            onClick={() => {
              setDetails(null);
              setIsRetrying(true);
              setRetryNonce((value) => value + 1);
            }}
            disabled={isRetrying}
            className="mx-auto gap-2 bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"
          >
            {isRetrying && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRetrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          Preparing your private AI examiner room…
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={details.token}
      serverUrl={details.serverUrl}
      connect
      audio
      video
      options={{ adaptiveStream: true, dynacast: true }}
      className="h-full min-h-[520px] bg-slate-950"
      onError={(error) => setRequestError(error.message)}
    >
      <RoomAudioRenderer />
      <StartAudio label="Enable examiner audio" className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950" />
      <LiveSpeakingStage
        agentName={details.agentName}
        agentDispatchError={details.agentDispatchError}
        candidateName={candidateName}
        prompt={prompt}
        onTranscriptChange={onTranscriptChange}
        onComplete={onComplete}
      />
    </LiveKitRoom>
  );
}

function LiveSpeakingStage({
  agentName,
  agentDispatchError,
  candidateName,
  prompt,
  onTranscriptChange,
  onComplete,
}: {
  agentName: string;
  agentDispatchError?: string | null;
  candidateName: string;
  prompt: string;
  onTranscriptChange: (transcript: string) => void;
  onComplete: (transcript: string) => void | Promise<void>;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);

  const localParticipant = participants.find((participant) => participant.isLocal);
  const examinerParticipant = participants.find((participant) => !participant.isLocal);
  const candidateTrack = cameraTracks.find((reference) => reference.participant.isLocal);
  const examinerTrack = cameraTracks.find((reference) => !reference.participant.isLocal);

  const candidateTranscript = useMemo(
    () => lines.filter((line) => line.speaker === "candidate").map((line) => line.text).join(" ").trim(),
    [lines],
  );

  const fallbackTranscript = useMemo(
    () => lines.map((line) => `${line.speaker === "candidate" ? "Candidate" : "Examiner"}: ${line.text}`).join(" ").trim(),
    [lines],
  );

  useEffect(() => {
    const handleTranscription = (segments: TranscriptionSegment[], participant?: Participant) => {
      const speaker: TranscriptLine["speaker"] = participant?.isLocal ? "candidate" : "examiner";

      setLines((currentLines) => {
        const next = new Map(currentLines.map((line) => [line.id, line]));
        segments.forEach((segment) => {
          next.set(`${speaker}:${segment.id}`, {
            id: `${speaker}:${segment.id}`,
            text: segment.text,
            speaker,
            final: segment.final,
            startTime: segment.startTime,
          });
        });

        return Array.from(next.values()).sort((a, b) => a.startTime - b.startTime);
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room]);

  useEffect(() => {
    onTranscriptChange(candidateTranscript || fallbackTranscript);
  }, [candidateTranscript, fallbackTranscript, onTranscriptChange]);

  const finishExam = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await onComplete(candidateTranscript || fallbackTranscript);
    } finally {
      setIsFinishing(false);
    }
  };

  const statusText = examinerParticipant
    ? "AI examiner connected"
    : agentDispatchError
      ? "Waiting for AI examiner service"
      : "Connecting to AI examiner";

  return (
    <div className="flex h-full min-h-[520px] flex-col bg-slate-950 text-white lg:flex-row">
      <div className="flex min-h-[360px] flex-1 flex-col border-b border-slate-800 p-5 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">
            <span className={`h-2 w-2 rounded-full ${examinerParticipant ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            {statusText}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <Wifi className="h-3.5 w-3.5" />
            Private exam room
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center py-6">
          <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border-4 border-slate-800 bg-slate-900 shadow-2xl">
            {examinerTrack ? (
              <ParticipantTile trackRef={examinerTrack} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            ) : (
              <Image
                src="/examiner.png"
                alt="AI IELTS examiner"
                fill
                sizes="(max-width: 1024px) 90vw, 60vw"
                className="object-cover"
              />
            )}
            <div className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white">
              {agentName} · AI examiner
            </div>
            {examinerParticipant && (
              <div className="absolute right-2 top-2 rounded bg-emerald-500 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white">
                Live
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-1/2 w-[min(90%,38rem)] -translate-x-1/2 rounded-xl border border-slate-700 bg-black/75 p-4 text-center backdrop-blur">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-amber-300">Examiner prompt</p>
            <p className="text-sm leading-relaxed text-slate-100">“{prompt}”</p>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-4 overflow-y-auto bg-slate-900/60 p-5 lg:w-[430px] xl:w-[500px]">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
          {candidateTrack ? (
            <ParticipantTile trackRef={candidateTrack} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-600">
              <VideoOff className="h-10 w-10" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
            {candidateName}
          </div>
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[9px] font-bold uppercase tracking-wider">
            {isCameraEnabled ? <Video className="h-3 w-3 text-emerald-400" /> : <VideoOff className="h-3 w-3 text-rose-400" />}
            Camera
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-white hover:bg-slate-700"
          >
            {isMicrophoneEnabled ? <Mic className="h-3.5 w-3.5 text-emerald-400" /> : <MicOff className="h-3.5 w-3.5 text-rose-400" />}
            {isMicrophoneEnabled ? "Mute" : "Unmute"}
          </TrackToggle>
          <TrackToggle
            source={Track.Source.Camera}
            showIcon={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-white hover:bg-slate-700"
          >
            {isCameraEnabled ? <Video className="h-3.5 w-3.5 text-emerald-400" /> : <VideoOff className="h-3.5 w-3.5 text-rose-400" />}
            {isCameraEnabled ? "Camera on" : "Camera off"}
          </TrackToggle>
        </div>

        <div className="min-h-[160px] flex-1 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live transcript</span>
            <span className="text-[10px] font-mono text-slate-500">{lines.length} segments</span>
          </div>
          <div className="max-h-[230px] space-y-2 overflow-y-auto pr-1 text-xs leading-relaxed">
            {lines.length === 0 ? (
              <p className="text-slate-500">The examiner will greet you shortly. Speak naturally when asked.</p>
            ) : (
              lines.map((line) => (
                <p key={line.id} className={line.speaker === "candidate" ? "text-slate-100" : "text-amber-200"}>
                  <span className="mr-1 font-bold">{line.speaker === "candidate" ? "You:" : "Examiner:"}</span>
                  {line.text}
                </p>
              ))
            )}
          </div>
        </div>

        {agentDispatchError && !examinerParticipant && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] leading-relaxed text-amber-200">
            The room is open, but the AI agent has not joined yet. Start the agent service and reconnect this stage if it remains here.
          </p>
        )}

        <Button
          onClick={finishExam}
          disabled={isFinishing || !localParticipant}
          className="h-11 w-full gap-2 bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"
        >
          {isFinishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isFinishing ? "Finalizing speaking…" : "Complete Speaking Test"}
        </Button>
      </div>
    </div>
  );
}
