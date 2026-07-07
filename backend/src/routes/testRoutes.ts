import { Router } from "express";
import { TestController } from "../controllers/testController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/reading/tests", requireAuth, TestController.getReadingTests);
router.post("/reading/submit", requireAuth, TestController.submitReading);

router.get("/listening/tests", requireAuth, TestController.getListeningTests);
router.post("/listening/submit", requireAuth, TestController.submitListening);

export default router;
