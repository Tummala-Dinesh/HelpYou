import { useState } from "react";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { generateCourse } from "../api.js";

function getErrorMessage(error) {
  return (
    error.response?.data?.error ||
    error.response?.data?.detail ||
    error.message ||
    "We couldn't generate your course. Please try again."
  );
}

export default function CourseGenerator({ onCourseGenerated }) {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const course = await generateCourse(topic.trim(), difficulty);
      onCourseGenerated(course);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="generator-layout" aria-labelledby="generator-title">
        <div className="generator-copy">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <BookOpen size={21} />
            </span>
            <span>Coursecraft</span>
          </div>
          <p className="eyebrow">
            <Sparkles size={15} aria-hidden="true" />
            YOUR PERSONAL LEARNING STUDIO
          </p>
          <h1 id="generator-title">
            Learn something
            <br />
            <span>new, your way.</span>
          </h1>
          <p className="intro">
            Turn a topic you care about into a thoughtful course, with a clear
            path from the fundamentals to what comes next.
          </p>
          <div className="feature-note">
            <span className="feature-icon" aria-hidden="true">
              <BookOpen size={18} />
            </span>
            <span>Organized modules, focused lessons, hand-picked videos</span>
          </div>
        </div>

        <form className="generator-card" onSubmit={handleSubmit}>
          <div className="form-heading">
            <span className="form-step">START A NEW COURSE</span>
            <h2>What would you like to learn?</h2>
            <p>Choose a topic and we’ll shape a course around your level.</p>
          </div>

          <label className="field-label" htmlFor="course-topic">
            Topic
          </label>
          <input
            id="course-topic"
            className="form-control"
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. Creative writing, data science..."
            required
            maxLength={200}
            disabled={isLoading}
          />

          <label className="field-label" htmlFor="course-difficulty">
            Your experience
          </label>
          <select
            id="course-difficulty"
            className="form-control"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            disabled={isLoading}
          >
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={isLoading}>
            <span>{isLoading ? "Generating your course..." : "Create my course"}</span>
            {!isLoading && <ArrowRight size={18} aria-hidden="true" />}
            {isLoading && <span className="loading-spinner" aria-hidden="true" />}
          </button>
          <p className="form-footnote">A complete learning path, made just for you.</p>
        </form>
      </section>
    </main>
  );
}
