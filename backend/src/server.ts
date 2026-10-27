import dotenv from "dotenv";
// .env.local (gitignored, for local overrides) wins over .env.
dotenv.config({ path: [".env.local", ".env"], quiet: true });
import express from "express";
import cors from "cors";

import chatRoutes from "./routes/chatRoutes";
import writingRoutes from "./routes/writingRoutes";
import speakingRoutes from "./routes/speakingRoutes";
import testRoutes from "./routes/testRoutes";
import plannerRoutes from "./routes/plannerRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import simulatorRoutes from "./routes/simulatorRoutes";

const app = express();
const PORT = process.env.PORT || 8000;

// Auth is bearer-token based, so no cookies cross origins. Restrict origins via CORS_ORIGIN if desired.
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/chat", chatRoutes);
app.use("/api/writing", writingRoutes);
app.use("/api/speaking", speakingRoutes);
app.use("/api/test", testRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/simulator", simulatorRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "IELTS AI Mentor Platform Express Backend Active" });
});

app.listen(PORT, () => {
  console.log(`[Server] Express active on port ${PORT}`);
});
