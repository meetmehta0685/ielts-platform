import { Router } from "express";
import { DashboardController } from "../controllers/dashboardController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/stats", requireAuth, DashboardController.getStats);

export default router;
