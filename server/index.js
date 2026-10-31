import "dotenv/config";
import axios from "axios";
import cors from "cors";
import express from "express";
import pool from "./db.js";
import courseRoutes from "./routes/courseRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";

const app = express();
const port = Number(process.env.PORT) || 5000;
const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:8000";

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://help-you-umber.vercel.app/",
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use("/api/courses", courseRoutes);
app.use("/api/quizzes", quizRoutes);

app.get("/api/health", async (_req, res) => {
  const checks = {
    database: { status: "ok" },
    aiEngine: { status: "ok" },
  };

  try {
    const result = await pool.query("SELECT NOW();");
    checks.database.timestamp = result.rows[0].now;
  } catch (error) {
    checks.database = { status: "error", message: error.message };
  }

  try {
    const healthUrl = new URL("/health", aiEngineUrl);
    await axios.get(healthUrl.href, { timeout: 5000 });
  } catch (error) {
    checks.aiEngine = { status: "error", message: error.message };
  }

  const healthy = Object.values(checks).every(
    (check) => check.status === "ok",
  );

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "error",
    checks,
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
