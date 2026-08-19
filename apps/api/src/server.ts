import express from "express";
import cors from "cors";
import { config } from "./config";
import heatmapRouter from "./routes/heatmap";
import routesRouter from "./routes/routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    error: false,
    message: "ok",
    data: { status: "ok" }
  });
});

app.use("/api/heatmap", heatmapRouter);
app.use("/api", routesRouter);

app.listen(config.port, () => {
  console.log(`Aither API listening on port ${config.port}`);
});