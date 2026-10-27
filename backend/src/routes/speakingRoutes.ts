import { Router } from "express";
import multer from "multer";
import { SpeakingController } from "../controllers/speakingController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();
// Whisper accepts up to 25 MB per file.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post("/transcribe", requireAuth, upload.single("audio"), SpeakingController.transcribeAudio);
router.post("/evaluate", requireAuth, SpeakingController.evaluateSpeaking);
router.post("/synthesize", requireAuth, SpeakingController.synthesizeText);

export default router;
