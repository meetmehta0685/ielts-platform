import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { SimulatorController } from "../controllers/simulatorController";

const router = Router();

router.post("/speaking/session", requireAuth, SimulatorController.createSpeakingSession);

export default router;
