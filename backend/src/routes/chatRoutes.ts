import { Router } from "express";
import { ChatController } from "../controllers/chatController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

// Secure all chat endpoints using requireAuth middleware
router.post("/session", requireAuth, ChatController.createSession);
router.get("/sessions/:userId", requireAuth, ChatController.getUserSessions);
router.get("/messages/:sessionId", requireAuth, ChatController.getSessionMessages);
router.post("/stream", requireAuth, ChatController.streamMessage);

export default router;
