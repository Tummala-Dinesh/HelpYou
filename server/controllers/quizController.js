import axios from "axios";
import pool from "../db.js";

export async function generateAndSaveQuiz(req, res) {
  const { lessonId } = req.body ?? {};

  if (typeof lessonId !== "string" || !lessonId.trim()) {
    return res.status(400).json({ error: "A lessonId is required." });
  }

  let client;
  let transactionStarted = false;

  try {
    const lessonResult = await pool.query(
      `SELECT title, topics_to_cover, youtube_transcript
       FROM lessons
       WHERE id = $1`,
      [lessonId.trim()],
    );
    if (lessonResult.rowCount === 0) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    const chunkResult = await pool.query(
      `SELECT chunk_text
       FROM document_chunks
       WHERE lesson_id = $1
       ORDER BY id`,
      [lessonId.trim()],
    );
    const lesson = lessonResult.rows[0];
    const transcript = [
      lesson.youtube_transcript,
      ...chunkResult.rows.map((row) => row.chunk_text),
    ]
      .filter((text) => typeof text === "string" && text.trim())
      .join("\n\n");

    const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:8000";
    const response = await axios.post(
      new URL("/api/generate-quiz", aiEngineUrl).href,
      {
        lesson_id: lessonId.trim(),
        lesson_title: lesson.title || "",
        topics_to_cover: Array.isArray(lesson.topics_to_cover)
          ? lesson.topics_to_cover
          : [],
        transcript,
      },
      { timeout: 60000 },
    );
    const questions = response.data?.questions;

    if (
      !Array.isArray(questions) ||
      questions.length !== 3 ||
      questions.some(
        (question) =>
          typeof question.question !== "string" ||
          !Array.isArray(question.options) ||
          typeof question.correct_answer !== "string" ||
          typeof question.explanation !== "string",
      )
    ) {
      throw new Error("AI engine returned an invalid quiz.");
    }

    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const savedQuestions = [];
    for (const question of questions) {
      const result = await client.query(
        `INSERT INTO quizzes
           (lesson_id, question, options, correct_answer, explanation)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          lessonId.trim(),
          question.question,
          JSON.stringify(question.options),
          question.correct_answer,
          question.explanation,
        ],
      );

      savedQuestions.push({ id: result.rows[0].id, ...question });
    }

    await client.query("COMMIT");
    transactionStarted = false;
    return res.status(201).json({ questions: savedQuestions });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Quiz transaction rollback failed:", rollbackError);
      }
    }

    console.error("Quiz generation or persistence failed:", error);
    const isAiEngineError = axios.isAxiosError(error);
    return res.status(isAiEngineError ? 502 : 500).json({
      error: isAiEngineError
        ? error.response?.data?.detail || error.message
        : "Failed to generate and save the quiz.",
    });
  } finally {
    client?.release();
  }
}

export async function getQuizByLessonId(req, res) {
  const { lessonId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, question, options, correct_answer, explanation
       FROM quizzes
       WHERE lesson_id = $1
       ORDER BY id ASC`,
      [lessonId],
    );
    return res.status(200).json({ questions: result.rows });
  } catch (error) {
    console.error(`Quiz retrieval failed for lesson ${lessonId}:`, error);
    return res.status(500).json({ error: "Failed to retrieve the quiz." });
  }
}
