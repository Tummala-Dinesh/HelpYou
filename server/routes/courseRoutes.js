import { Router } from "express";
import {
  generateAndSaveCourse,
  getCourseById,
} from "../controllers/courseController.js";

const courseRoutes = Router();

courseRoutes.post("/generate", generateAndSaveCourse);
courseRoutes.get("/:id", getCourseById);

export default courseRoutes;
