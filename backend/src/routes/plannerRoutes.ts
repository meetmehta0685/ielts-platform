import { Router } from "express";
import { PlannerController } from "../controllers/plannerController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.post("/generate", requireAuth, PlannerController.generatePlan);
router.get("/active", requireAuth, PlannerController.getPlan);
router.put("/active", requireAuth, PlannerController.updatePlan);

export default router;
