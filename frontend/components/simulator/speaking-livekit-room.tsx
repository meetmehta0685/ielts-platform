"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, Track, type Participant, type TextStreamReader } from "livekit-client";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RoomDetails = {
  roomName: string;
  participantIdentity: string;
  agentIdentity: string;
  agentName: string;
  agentDispatchError?: string | null;
  serverUrl: string;
  token: string;
  speakingPrompt: string;
};

// Published by @livekit/agents as text streams for both the candidate's and the examiner's speech.
const TRANSCRIPTION_TOPIC = "lk.transcription";
const SEGMENT_ID_ATTRIBUTE = "lk.segment_id";

type TranscriptLine = {
  id: string;
  text: string;
  speaker: "candidate" | "examiner";
  startTime: number;
};

export interface SpeakingLiveKitRoomProps {
  backendUrl: string;
  authToken: string;
  attemptId: string;
  candidateName: string;
  onPromptChange: (prompt: string) => void;
  onTranscriptChange: (transcript: string) => void;
}

/* ------------------------------------------------------------------------------------------------
 * Presentational pieces shared by the pre-connection and live states.
 * --------------------------------------------------------------------------------------------- */

type RoomState = "preparing" | "connecting" | "waiting" | "live" | "unavailable";

const STATUS: Record<RoomState, { text: string; dot: string }> = {
  preparing: { text: "Opening your exam room", dot: "bg-line-strong" },
  connecting: { text: "Connecting to the examiner", dot: "bg-line-strong" },
  waiting: { text: "Room open. The examiner has not joined yet", dot: "bg-line-strong" },
  live: { text: "Examiner connected", dot: "bg-good" },
  unavailable: { text: "Examiner unavailable", dot: "bg-bad" },
};

function StatusLine({ state, aside }: { state: RoomState; aside?: ReactNode }) {
  const s = STATUS[state];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p key={state} className="t-swap inline-flex items-center gap-2 text-[15px] text-ink" aria-live="polite">
        <span className={cn("size-2 rounded-full", s.dot)} aria-hidden />
        <span className={state === "preparing" || state === "connecting" ? "t-shimmer" : undefined}>{s.text}</span>
      </p>
      {aside}
    </div>
  );
}

function TileLabel({ children }: { children: ReactNode }) {
  return (
    <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-sheet px-3 py-1 text-[13px] font-medium text-ink">
      {children}
    </span>
  );
}

function ExaminerPortrait({ dim }: { dim?: boolean }) {
  return (
    <Image
      src="/examiner.png"
      alt="AI IELTS examiner"
      fill
      sizes="(max-width: 1024px) 90vw, 60vw"
      className={cn("object-cover transition-opacity duration-[var(--duration-slow)]", dim && "opacity-40 grayscale")}
    />
  );
}

function CueCard({ prompt }: { prompt: string | null }) {
  return (
    <section aria-label="Cue card" className="rounded-2xl border border-border bg-sheet p-5">
      <p className="text-[13px] text-soft">Cue card · the topic the examiner will ask about</p>
      {prompt ? (
        <p className="mt-2 text-[17px] leading-normal text-ink">{prompt}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2" aria-hidden>
          <span className="t-skel block h-4 w-11/12" />
          <span className="t-skel block h-4 w-8/12" />
        </div>
      )}
      <p className="mt-3 text-[14px] text-soft">Answer out loud. Give reasons and examples, and keep going until the examiner moves on.</p>
    </section>
  );
}

function TranscriptPanel({ lines, placeholder }: { lines: TranscriptLine[]; placeholder: string }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep the newest line in view without scrolling the page around it.
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines]);
  return (
    <section aria-label="Live transcript" className="flex min-h-[220px] flex-1 flex-col rounded-2xl bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold text-ink">Live transcript</h2>
        <span className="tabular text-[13px] text-soft">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
        </span>
      </div>
      <div ref={listRef} className="max-h-[320px] flex-1 overflow-y-auto pr-1" aria-live="polite">
        {lines.length === 0 ? (
          <p className="text-[15px] leading-normal text-soft">{placeholder}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {lines.map((line) => (
              <li key={line.id} className="t-rise">
                <p className="text-[13px] text-soft">{line.speaker === "candidate" ? "You" : "Examiner"}</p>
                <p className="text-[15px] leading-normal text-ink">{line.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/** The room before LiveKit is up: same layout, honest state. */
function RoomPlaceholder({
  state,
  candidateName,
  error,
  onRetry,
  retrying,
  prompt = null,
}: {
  state: "preparing" | "unavailable";
  candidateName: string;
  prompt?: string | null;
  error?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <StatusLine state={state} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <div className="relative">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-panel-strong">
              <ExaminerPortrait dim />
              {state !== "unavailable" && <TileLabel>Examiner</TileLabel>}
            </div>
            {state === "unavailable" && (
              <div className="mt-4 sm:absolute sm:inset-0 sm:mt-0 sm:flex sm:items-center sm:justify-center sm:p-6">
              <div className="t-rise max-w-[440px] rounded-2xl bg-panel p-6 sm:bg-sheet">
                  <h2 className="text-[17px] font-semibold text-ink">The AI examiner is not available right now.</h2>
                  <p className="mt-2 text-[15px] leading-normal text-soft">
                    The live exam room could not stay connected. Try again, or press Finish to end the mock;
                    Speaking will then be marked Not graded.
                  </p>
                  {error && <p className="mt-3 text-[13px] text-soft">Detail: {error}</p>}
                  <Button className="mt-5" onClick={onRetry} disabled={retrying}>
                    <span key={String(retrying)} className="t-swap">
                      {retrying ? "Trying again…" : "Try again"}
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <CueCard prompt={prompt} />
        </div>
        <div className="flex flex-col gap-5 lg:col-span-4">
          <div className="relative flex aspect-video items-center justify-center rounded-2xl bg-panel-strong text-soft">
            <VideoOff className="size-7" aria-hidden />
            <TileLabel>{candidateName}</TileLabel>
          </div>
          {state === "preparing" && (
            <p className="text-[14px] leading-normal text-soft">
              Your browser will ask for the microphone and camera when the room opens.
            </p>
          )}
          <TranscriptPanel lines={[]} placeholder="The transcript appears here once the interview starts." />
        </div>
      </div>
    </div>
  );
}

const DEVICE_ERRORS = new Set(["NotAllowedError", "NotFoundError", "NotReadableError", "OverconstrainedError"]);

export default function SpeakingLiveKitRoom({
  backendUrl,
  authToken,
  attemptId,
  candidateName,
  onPromptChange,
  onTranscriptChange,
}: SpeakingLiveKitRoomProps) {
  const [details, setDetails] = useState<RoomDetails | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [deviceFailure, setDeviceFailure] = useState<MediaDeviceKind | null>(null);
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
        onPromptChange((data as RoomDetails).speakingPrompt);
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
  }, [attemptId, authToken, backendUrl, candidateName, onPromptChange, retryNonce]);

  if (requestError) {
    return (
      <RoomPlaceholder
        state="unavailable"
        candidateName={candidateName}
        error={requestError}
        prompt={details?.speakingPrompt ?? null}
        retrying={isRetrying}
        onRetry={() => {
          setDetails(null);
          setIsRetrying(true);
          setRetryNonce((value) => value + 1);
        }}
      />
    );
  }

  if (!details) {
    return <RoomPlaceholder state="preparing" candidateName={candidateName} />;
  }

  return (
    <LiveKitRoom
      token={details.token}
      serverUrl={details.serverUrl}
      connect
      audio
      video={false}
      options={{ adaptiveStream: true, dynacast: true }}
      className="relative"
      // A refused or missing camera or microphone is the candidate's to fix and must not close the room;
      // only connection errors end it.
      onMediaDeviceFailure={(_, kind) => setDeviceFailure(kind ?? "audioinput")}
      onError={(error) => {
        if (DEVICE_ERRORS.has(error.name)) return;
        setRequestError(error.message);
      }}
    >
      <RoomAudioRenderer />
      <LiveSpeakingStage
        agentName={details.agentName}
        agentDispatchError={details.agentDispatchError}
        candidateName={candidateName}
        prompt={details.speakingPrompt}
        deviceFailure={deviceFailure}
        onTranscriptChange={onTranscriptChange}
      />
    </LiveKitRoom>
  );
}

function SpeakingBars({ participant, className }: { participant: Participant; className?: string }) {
  const speaking = useIsSpeaking(participant);
  if (!speaking) return null;
  return (
    <span className={cn("x-level inline-flex items-end gap-[2px]", className)} aria-label="Speaking">
      <span />
      <span />
      <span />
    </span>
  );
}

function LiveSpeakingStage({
  agentName,
  agentDispatchError,
  candidateName,
  prompt,
  deviceFailure,
  onTranscriptChange,
}: {
  agentName: string;
  agentDispatchError?: string | null;
  candidateName: string;
  prompt: string;
  deviceFailure: MediaDeviceKind | null;
  onTranscriptChange: (transcript: string) => void;
}) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const participants = useParticipants();
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );
  const [lines, setLines] = useState<TranscriptLine[]>([]);

  const examinerParticipant = participants.find((participant) => !participant.isLocal);
  const candidateTrack = cameraTracks.find((reference) => reference.participant.isLocal);
  const examinerTrack = cameraTracks.find((reference) => !reference.participant.isLocal);

  const candidateTranscript = useMemo(
    () => lines.filter((line) => line.speaker === "candidate").map((line) => line.text).join(" ").trim(),
    [lines],
  );

  useEffect(() => {
    const upsertLine = (line: TranscriptLine) => {
      setLines((currentLines) => {
        const existing = currentLines.find((current) => current.id === line.id);
        const next = existing
          ? currentLines.map((current) => (current.id === line.id ? { ...line, startTime: existing.startTime } : current))
          : [...currentLines, line];
        return next.sort((a, b) => a.startTime - b.startTime);
      });
    };

    const handleTranscriptionStream = async (reader: TextStreamReader, participantInfo: { identity: string }) => {
      const speaker: TranscriptLine["speaker"] =
        participantInfo.identity === room.localParticipant.identity ? "candidate" : "examiner";
      const segmentId = reader.info.attributes?.[SEGMENT_ID_ATTRIBUTE] ?? reader.info.id;
      const id = `${speaker}:${segmentId}`;
      let text = "";
      try {
        for await (const chunk of reader) {
          text += chunk;
          upsertLine({ id, text, speaker, startTime: reader.info.timestamp });
        }
      } catch (error) {
        console.error("[Speaking] Transcription stream failed:", error);
      }
    };

    room.registerTextStreamHandler(TRANSCRIPTION_TOPIC, handleTranscriptionStream);
    return () => {
      room.unregisterTextStreamHandler(TRANSCRIPTION_TOPIC);
    };
  }, [room]);

  useEffect(() => {
    onTranscriptChange(candidateTranscript);
  }, [candidateTranscript, onTranscriptChange]);

  const state: RoomState = examinerParticipant
    ? "live"
    : connection === ConnectionState.Connected
      ? agentDispatchError
        ? "waiting"
        : "connecting"
      : connection === ConnectionState.Disconnected
        ? "unavailable"
        : "connecting";

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <StatusLine
        state={state}
        aside={
          <StartAudio
            label="Turn on examiner audio"
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-white transition-colors duration-[var(--duration-quick)] hover:bg-ink-hover"
          />
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-panel-strong">
            {examinerTrack && isTrackReference(examinerTrack) ? (
              <VideoTrack trackRef={examinerTrack} className="h-full w-full object-cover" />
            ) : (
              <ExaminerPortrait dim={state !== "live"} />
            )}
            <TileLabel>
              {agentName} · examiner
              {examinerParticipant && <SpeakingBars participant={examinerParticipant} className="text-brand" />}
            </TileLabel>
            {state === "live" && (
              <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-sheet px-3 py-1 text-[13px] font-medium text-ink">
                <span className="size-1.5 rounded-full bg-good" aria-hidden />
                Live
              </span>
            )}
            {state === "waiting" && (
              <div className="absolute inset-x-3 top-3 rounded-xl bg-sheet px-4 py-3 text-[14px] leading-normal text-soft sm:right-auto sm:max-w-[420px]">
                The room is open but the AI examiner service has not joined. It needs the agent process running.
                You can wait, or press Finish; Speaking will then be marked Not graded.
              </div>
            )}
          </div>
          <CueCard prompt={prompt} />
        </div>

        <div className="flex flex-col gap-5 lg:col-span-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-panel-strong">
            {candidateTrack && isTrackReference(candidateTrack) && isCameraEnabled ? (
              <VideoTrack trackRef={candidateTrack} className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-soft">
                <VideoOff className="size-7" aria-hidden />
              </div>
            )}
            <TileLabel>
              {candidateName}
              <SpeakingBars participant={localParticipant} className="text-brand" />
            </TileLabel>
          </div>

          <div className="flex flex-col gap-2">
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon={false}
              className={cn(
                "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium transition-[background-color,color,transform] duration-[var(--duration-quick)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                isMicrophoneEnabled ? "bg-ink text-white hover:bg-ink-hover" : "bg-bad-tint text-bad hover:bg-bad-tint-hover"
              )}
            >
              {isMicrophoneEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              <span key={String(isMicrophoneEnabled)} className="t-swap">
                {isMicrophoneEnabled ? "Microphone on · tap to mute" : "Microphone off · tap to unmute"}
              </span>
            </TrackToggle>
            {deviceFailure === "audioinput" && !isMicrophoneEnabled ? (
              <p className="t-rise text-[14px] text-bad">
                Your browser blocked the microphone. Allow microphone access for this site, then turn it on.
              </p>
            ) : (
              !isMicrophoneEnabled && (
                <p className="t-rise text-[14px] text-bad">The examiner cannot hear you while the microphone is off.</p>
              )
            )}
            <TrackToggle
              source={Track.Source.Camera}
              showIcon={false}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-panel-strong text-[15px] font-medium text-ink transition-[background-color,transform] duration-[var(--duration-quick)] hover:bg-panel-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {isCameraEnabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
              {isCameraEnabled ? "Camera on" : "Camera off"}
            </TrackToggle>
            {deviceFailure === "videoinput" && !isCameraEnabled && (
              <p className="t-rise text-[14px] text-soft">The camera is blocked. The interview works without it.</p>
            )}
          </div>

          <TranscriptPanel
            lines={lines}
            placeholder={
              state === "live"
                ? "The examiner will greet you and start with Part 1. Speak naturally; your words appear here."
                : "The transcript starts when the examiner joins."
            }
          />
        </div>
      </div>
    </div>
  );
}
