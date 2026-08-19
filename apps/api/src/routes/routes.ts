import { Router } from "express";

const router = Router();

router.post("/route", (_req, res) => {
  res.status(501).json({
    error: true,
    message: "Route generation is not implemented yet (Phase 2).",
    data: null
  });
});

router.post("/route-risk", (_req, res) => {
  res.status(501).json({
    error: true,
    message: "Route risk analysis is not implemented yet (Phase 2).",
    data: null
  });
});

export default router;