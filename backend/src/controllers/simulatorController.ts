import { Response } from "express";
import { z } from "zod";
import { AccessToken, LiveKitAPI, TrackSource } from "livekit-server-sdk";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const speakingSessionSchema = z.object({
  attempt_id: z
    .string()
    .min(8)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/, "Attempt id contains unsupported characters"),
  candidate_name: z.string().trim().min(1).max(120).optional(),
});

class LiveKitConfigurationError extends Error {
  readonly code = "LIVEKIT_NOT_CONFIGURED";

  constructor() {
    super("LiveKit is not configured on the server.");
    this.name = "LiveKitConfigurationError";
  }
}

function getLiveKitConfig() {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const missing = [
    !url && "LIVEKIT_URL",
    !apiKey && "LIVEKIT_API_KEY",
    !apiSecret && "LIVEKIT_API_SECRET",
  ].filter((key): key is string => Boolean(key));

  if (missing.length > 0) {
    console.error(`[Simulator] Missing LiveKit environment variables: ${missing.join(", ")}`);
    throw new LiveKitConfigurationError();
  }

  if (!url || !apiKey || !apiSecret) {
    throw new LiveKitConfigurationError();
  }

  return { url, apiKey, apiSecret };
}

/**
 * Creates (or reuses) the LiveKit room used only by the simulator's Speaking stage.
 * The browser receives a short-lived candidate token; the LiveKit secret never leaves
 * the backend. The AI examiner is dispatched separately by its registered agent name.
 */
export class SimulatorController {
  static async createSpeakingSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const parsed = speakingSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({ error: "Authenticated user is required." });
        return;
      }

      const { url, apiKey, apiSecret } = getLiveKitConfig();
      const { attempt_id: attemptId, candidate_name: candidateName } = parsed.data;
      const userShortId = String(req.user.id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
      const roomName = `ielts-simulator-${userShortId}-${attemptId}`;
      const candidateIdentity = `candidate-${userShortId}-${attemptId}`;
      const agentName = process.env.LIVEKIT_AGENT_NAME || "ielts-examiner";

      const livekit = new LiveKitAPI({
        host: url,
        apiKey,
        secret: apiSecret,
      });

      // The room is normally created once per attempt. A second request (for example,
      // after a browser reconnect) reuses the same room instead of creating another one.
      try {
        await livekit.room.createRoom({
          name: roomName,
          emptyTimeout: 300,
          departureTimeout: 120,
          maxParticipants: 3,
          metadata: JSON.stringify({
            type: "ielts-speaking-simulator",
            userId: req.user.id,
            attemptId,
          }),
        });
      } catch (roomError: any) {
        // LiveKit returns a conflict when the idempotent reconnect path finds the
        // already-created room. Other errors are surfaced to the client below.
        const message = String(roomError?.message || roomError);
        if (!/already exists|already started|conflict/i.test(message)) {
          throw roomError;
        }
      }

      let dispatchId: string | null = null;
      let agentDispatchError: string | null = null;

      try {
        const existingDispatches = await livekit.agentDispatch.listDispatch(roomName);
        const existing = existingDispatches.find((dispatch) => dispatch.agentName === agentName);

        if (existing) {
          dispatchId = existing.id;
        } else {
          const dispatch = await livekit.agentDispatch.createDispatch(roomName, agentName, {
            metadata: JSON.stringify({
              type: "ielts-speaking-simulator",
              userId: req.user.id,
              attemptId,
              candidateName: candidateName || req.user.email?.split("@")[0] || "Candidate",
            }),
          });
          dispatchId = dispatch.id;
        }
      } catch (dispatchError: any) {
        // The candidate can still connect while the local/Cloud agent is starting.
        // Returning the warning gives the UI a useful diagnostic instead of failing
        // with an opaque token error.
        agentDispatchError = dispatchError?.message || "The AI examiner could not be dispatched yet.";
        console.error("[Simulator] LiveKit agent dispatch failed:", dispatchError);
      }

      const token = new AccessToken(apiKey, apiSecret, {
        identity: candidateIdentity,
        name: candidateName || req.user.email?.split("@")[0] || "Candidate",
        ttl: "2h",
        metadata: JSON.stringify({
          type: "candidate",
          userId: req.user.id,
          attemptId,
        }),
      });

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canSubscribe: true,
        canPublish: true,
        canPublishData: true,
        canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
      });

      res.status(200).json({
        roomName,
        participantIdentity: candidateIdentity,
        agentIdentity: "agent-ielts-examiner",
        agentName,
        dispatchId,
        agentDispatchError,
        serverUrl: url,
        token: await token.toJwt(),
        speakingPrompt:
          "Let's talk about cultural traditions. Do you think it is important for a society to maintain its traditional cultural values in the modern era, and why?",
      });
    } catch (error: any) {
      console.error("[Simulator] Create Speaking LiveKit session error:", error);

      if (error instanceof LiveKitConfigurationError) {
        res.status(503).json({
          code: error.code,
          error: "The AI examiner is temporarily unavailable. Please try again later.",
        });
        return;
      }

      res.status(500).json({ error: error.message || "Failed to create the speaking exam room." });
    }
  }
}
