import axios from "axios";
import pool from "../db.js";

const enrichingLessonIds = new Set();

export async function enrichCourseLessons(courseId, topic, lessonsToEnrich) {
  const aiEngineUrl = process.env.AI_ENGINE_URL || "http://localhost:8000";
  let enrichmentUrl;
  try {
    enrichmentUrl = new URL("/api/enrich-lesson", aiEngineUrl).href;
  } catch (error) {
    console.error("Invalid AI engine URL; lesson enrichment was not started:", error);
    return;
  }

  const lessons = lessonsToEnrich.filter(
    (lesson) =>
      lesson.lesson_id && !enrichingLessonIds.has(lesson.lesson_id),
  );
  for (const lesson of lessons) {
    enrichingLessonIds.add(lesson.lesson_id);
  }

  for (const lesson of lessons) {
    try {
      const response = await axios.post(
        enrichmentUrl,
        {
          course_id: courseId,
          lesson_id: lesson.lesson_id,
          search_query: lesson.search_query || `${topic} ${lesson.title}`,
        },
        { timeout: 60000 },
      );
      const { video_id: videoId, youtube_title: youtubeTitle, transcript } =
        response.data ?? {};

      if (
        typeof videoId !== "string" ||
        typeof youtubeTitle !== "string" ||
        typeof transcript !== "string"
      ) {
        throw new Error("AI engine returned invalid lesson enrichment data.");
      }

      const updateResult = await pool.query(
        `UPDATE lessons
         SET youtube_video_id = $1, youtube_title = $2, youtube_transcript = $3
         WHERE id = $4`,
        [videoId, youtubeTitle, transcript, lesson.lesson_id],
      );
      if (updateResult.rowCount === 0) {
        console.error(`Enriched lesson ${lesson.lesson_id} no longer exists.`);
      }
    } catch (error) {
      console.error(
        `Background enrichment failed for lesson ${lesson.lesson_id}:`,
        error,
      );
    } finally {
      enrichingLessonIds.delete(lesson.lesson_id);
    }
  }
}

export async function generateAndSaveCourse(req, res) {
  const { topic, difficulty } = req.body ?? {};

  if (
    typeof topic !== "string" ||
    !topic.trim() ||
    typeof difficulty !== "string" ||
    !difficulty.trim()
  ) {
    return res
      .status(400)
      .json({ error: "Both topic and difficulty are required." });
  }

  let client;
  let transactionStarted = false;

  try {
    const aiEngineUrl =
      process.env.AI_ENGINE_URL || "http://localhost:8000";
    const response = await axios.post(
      new URL("/api/generate-syllabus", aiEngineUrl).href,
      { topic: topic.trim(), difficulty: difficulty.trim() },
      { timeout: 60000 },
    );
    const syllabus = response.data;

    if (
      typeof syllabus?.course_title !== "string" ||
      !Array.isArray(syllabus.modules)
    ) {
      throw new Error("AI engine returned an invalid syllabus.");
    }

    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const courseResult = await client.query(
      `INSERT INTO courses (title, topic, difficulty)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [syllabus.course_title, topic.trim(), syllabus.difficulty ?? difficulty],
    );

    const course = {
      id: courseResult.rows[0].id,
      course_title: syllabus.course_title,
      topic: topic.trim(),
      difficulty: syllabus.difficulty ?? difficulty,
      modules: [],
    };
    const lessonsToEnrich = [];

    for (const moduleData of syllabus.modules) {
      const moduleResult = await client.query(
        `INSERT INTO modules (course_id, title, module_order, summary)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          course.id,
          moduleData.title,
          moduleData.module_order,
          moduleData.summary,
        ],
      );

      const module = {
        id: moduleResult.rows[0].id,
        title: moduleData.title,
        module_order: moduleData.module_order,
        summary: moduleData.summary,
        lessons: [],
      };

      for (const lessonData of moduleData.lessons) {
        const lessonResult = await client.query(
          `INSERT INTO lessons (module_id, title, lesson_order, topics_to_cover)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [
            module.id,
            lessonData.title,
            lessonData.lesson_order,
            JSON.stringify(lessonData.topics_to_cover),
          ],
        );

        lessonsToEnrich.push({
          course_id: course.id,
          lesson_id: lessonResult.rows[0].id,
          search_query: `${topic.trim()} ${lessonData.title}`,
        });

        module.lessons.push({
          id: lessonResult.rows[0].id,
          title: lessonData.title,
          lesson_order: lessonData.lesson_order,
          topics_to_cover: lessonData.topics_to_cover,
        });
      }

      course.modules.push(module);
    }

    await client.query("COMMIT");
    transactionStarted = false;

    void enrichCourseLessons(course.id, topic.trim(), lessonsToEnrich);

    return res.status(201).json(course);
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Course transaction rollback failed:", rollbackError);
      }
    }

    console.error("Course generation or persistence failed:", error);
    const isAiEngineError = axios.isAxiosError(error);
    const status = isAiEngineError ? 502 : 500;
    return res.status(status).json({
      error: isAiEngineError
        ? error.response?.data?.detail || error.message
        : "Failed to generate and save the course.",
    });
  } finally {
    client?.release();
  }
}

export async function getCourseById(req, res) {
  const { id } = req.params;

  try {
    const courseResult = await pool.query(
      `SELECT id, title AS course_title, topic, difficulty
       FROM courses
       WHERE id = $1`,
      [id],
    );

    if (courseResult.rowCount === 0) {
      return res.status(404).json({ error: "Course not found." });
    }

    const course = {
      ...courseResult.rows[0],
      modules: [],
    };
    const moduleResult = await pool.query(
      `SELECT id, title, module_order, summary
       FROM modules
       WHERE course_id = $1
       ORDER BY module_order`,
      [id],
    );
    const modulesById = new Map();

    for (const moduleRow of moduleResult.rows) {
      const module = { ...moduleRow, lessons: [] };
      course.modules.push(module);
      modulesById.set(module.id, module);
    }

    if (modulesById.size > 0) {
      const missingLessonsToEnrich = [];
      const lessonResult = await pool.query(
        `SELECT id, module_id, title, lesson_order, topics_to_cover,
                youtube_video_id, youtube_title, youtube_transcript
         FROM lessons
         WHERE module_id = ANY($1::uuid[])
         ORDER BY lesson_order`,
        [[...modulesById.keys()]],
      );

      for (const lesson of lessonResult.rows) {
        if (!lesson.youtube_video_id) {
          missingLessonsToEnrich.push({
            lesson_id: lesson.id,
            title: lesson.title,
            search_query: `${course.topic} ${lesson.title}`,
          });
        }
        modulesById.get(lesson.module_id).lessons.push({
          id: lesson.id,
          title: lesson.title,
          lesson_order: lesson.lesson_order,
          topics_to_cover: lesson.topics_to_cover,
          youtube_video_id: lesson.youtube_video_id,
          youtube_title: lesson.youtube_title,
          youtube_transcript: lesson.youtube_transcript,
        });
      }

      if (missingLessonsToEnrich.length > 0) {
        void enrichCourseLessons(
          course.id,
          course.topic,
          missingLessonsToEnrich,
        );
      }
    }

    return res.status(200).json(course);
  } catch (error) {
    console.error("Course retrieval failed:", error);
    return res.status(500).json({ error: "Failed to retrieve the course." });
  }
}
