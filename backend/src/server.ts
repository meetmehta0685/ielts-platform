import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

import chatRoutes from "./routes/chatRoutes";
import writingRoutes from "./routes/writingRoutes";
import speakingRoutes from "./routes/speakingRoutes";
import testRoutes from "./routes/testRoutes";
import plannerRoutes from "./routes/plannerRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import simulatorRoutes from "./routes/simulatorRoutes";

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: "*", // Adjust to frontend URL in production
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Routes Mount
app.use("/api/chat", chatRoutes);
app.use("/api/writing", writingRoutes);
app.use("/api/speaking", speakingRoutes);
app.use("/api/test", testRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/simulator", simulatorRoutes);

// Health Check
app.get("/", (req, res) => {
  res.json({ message: "IELTS AI Mentor Platform Express Backend Active" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] Express active on port ${PORT}`);
});
