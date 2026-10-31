import { Router } from "express";
import {
  generateAndSaveQuiz,
  getQuizByLessonId,
} from "../controllers/quizController.js";

const quizRoutes = Router();

quizRoutes.post("/generate", generateAndSaveQuiz);
quizRoutes.get("/:lessonId", getQuizByLessonId);

export default quizRoutes;
