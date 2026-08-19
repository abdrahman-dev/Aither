import { Router } from "express";

const router = Router();

router.post("/", (_req, res) => {
  res.status(501).json({
    error: true,
    message: "Heatmap generation is not implemented yet (Phase 2).",
    data: null
  });
});

export default router;