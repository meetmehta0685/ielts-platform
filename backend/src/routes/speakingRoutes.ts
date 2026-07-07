import { Router } from "express";
import multer from "multer";
import { SpeakingController } from "../controllers/speakingController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/transcribe", requireAuth, upload.single("audio"), SpeakingController.transcribeAudio);
router.post("/evaluate", requireAuth, SpeakingController.evaluateSpeaking);
router.post("/synthesize", requireAuth, SpeakingController.synthesizeText);
router.get("/history", requireAuth, SpeakingController.getSubmissions);

export default router;
