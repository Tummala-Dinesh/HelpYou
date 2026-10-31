import { useEffect, useState } from "react";
import { BookOpen, CirclePlay, Clock3 } from "lucide-react";
import { getCourse } from "../api.js";
import QuizViewer from "./QuizViewer.jsx";

export default function CourseViewer({ course }) {
  const [currentCourse, setCurrentCourse] = useState(course);

  useEffect(() => {
    setCurrentCourse(course);
  }, [course]);

  useEffect(() => {
    let isActive = true;
    let intervalId;

    const hasMissingVideos = (courseData) =>
      courseData.modules.some((module) =>
        module.lessons.some((lesson) => !lesson.youtube_video_id),
      );

    async function refreshCourse() {
      try {
        const refreshedCourse = await getCourse(course.id);

        if (!isActive) {
          return;
        }

        setCurrentCourse(refreshedCourse);
        if (!hasMissingVideos(refreshedCourse)) {
          window.clearInterval(intervalId);
        }
      } catch (error) {
        console.error("Course refresh failed:", error);
      }
    }

    if (hasMissingVideos(course)) {
      void refreshCourse();
      intervalId = window.setInterval(refreshCourse, 3000);
    }

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [course]);

  return (
    <main className="viewer-shell">
      <header className="viewer-header">
        <a className="brand-lockup" href="/" aria-label="Coursecraft home">
          <span className="brand-mark" aria-hidden="true">
            <BookOpen size={21} />
          </span>
          <span>Coursecraft</span>
        </a>
        <span className="difficulty-badge">{currentCourse.difficulty}</span>
      </header>

      <section className="course-intro">
        <p className="eyebrow">YOUR LEARNING PATH</p>
        <h1>{currentCourse.course_title}</h1>
        <p className="course-topic">{currentCourse.topic}</p>
        <div className="course-meta">
          <span>
            <BookOpen size={16} aria-hidden="true" />
            {currentCourse.modules.length}{" "}
            {currentCourse.modules.length === 1 ? "module" : "modules"}
          </span>
          <span>
            <Clock3 size={16} aria-hidden="true" />
            Learn at your own pace
          </span>
        </div>
      </section>

      <section className="modules-list" aria-label="Course modules">
        {currentCourse.modules.map((module, moduleIndex) => (
          <article className="module-card" key={module.id ?? module.module_order}>
            <header className="module-heading">
              <span className="module-number">
                {String(module.module_order ?? moduleIndex + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="module-kicker">MODULE {moduleIndex + 1}</p>
                <h2>{module.title}</h2>
                {module.summary && <p className="module-summary">{module.summary}</p>}
              </div>
            </header>

            <div className="lessons-list">
              {module.lessons.map((lesson, lessonIndex) => (
                <article className="lesson-card" key={lesson.id ?? lesson.lesson_order}>
                  <div className="lesson-title-row">
                    <span className="lesson-index">{lessonIndex + 1}</span>
                    <h3>{lesson.title}</h3>
                  </div>

                  {Array.isArray(lesson.topics_to_cover) &&
                    lesson.topics_to_cover.length > 0 && (
                      <ul className="topic-list">
                        {lesson.topics_to_cover.map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                    )}

                  <div className="video-panel">
                    {lesson.youtube_video_id ? (
                      <iframe
                        className="video-frame"
                        src={`https://www.youtube.com/embed/${encodeURIComponent(
                          lesson.youtube_video_id,
                        )}`}
                        title={lesson.youtube_title || `Video for ${lesson.title}`}
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : (
                      <div className="video-pending">
                        <CirclePlay size={23} aria-hidden="true" />
                        <span>Finding a helpful video for this lesson</span>
                      </div>
                    )}
                  </div>
                  <QuizViewer lessonId={lesson.id} />
                </article>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
