import { Router } from "express";
import { WritingController } from "../controllers/writingController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.post("/evaluate", requireAuth, WritingController.evaluateEssay);

export default router;
