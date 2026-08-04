import { ServerOptions, cli, defineAgent, inference, voice } from "@livekit/agents";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createExaminerAgent } from "./agent.js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
dotenv.config({ path: "../backend/.env" });

const sttModel = process.env.LIVEKIT_STT_MODEL || "deepgram/nova-3";
const llmModel = process.env.LIVEKIT_LLM_MODEL || "google/gemma-4-31b-it";
const ttsModel = process.env.LIVEKIT_TTS_MODEL || "inworld/inworld-tts-2";
const ttsVoice = process.env.LIVEKIT_TTS_VOICE || "Ashley";
const agentName = process.env.LIVEKIT_AGENT_NAME || "ielts-examiner";

export default defineAgent({
  entry: async (ctx) => {
    const session = new voice.AgentSession({
      stt: new inference.STT({
        model: sttModel,
        language: "en",
      }),
      llm: new inference.LLM({
        model: llmModel,
      }),
      tts: new inference.TTS({
        model: ttsModel,
        voice: ttsVoice,
        language: "en",
      }),
      turnHandling: {
        turnDetection: new inference.TurnDetector(),
        preemptiveGeneration: { enabled: true },
      },
    });

    await session.start({
      agent: createExaminerAgent(),
      room: ctx.room,
    });

    await ctx.connect();

    await session.generateReply({
      instructions:
        "Start the IELTS speaking interview now. Greet the candidate and ask for their full name. Do not explain the scoring rubric.",
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName,
  }),
);
