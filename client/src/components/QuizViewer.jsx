import { useEffect, useState } from "react";
import { Check, CircleHelp, LoaderCircle, Sparkles, X } from "lucide-react";
import { generateQuiz, getQuiz } from "../api.js";

function getErrorMessage(error) {
  return (
    error.response?.data?.error ||
    error.response?.data?.detail ||
    error.message ||
    "The knowledge check could not be loaded."
  );
}

export default function QuizViewer({ lessonId }) {
  const [questions, setQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [generationFailed, setGenerationFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadQuiz() {
      setIsLoading(true);
      setQuestions([]);
      setSelectedAnswers({});
      setHasSubmitted(false);
      setErrorMessage("");
      setGenerationFailed(false);

      try {
        const result = await getQuiz(lessonId);
        if (isActive) {
          setQuestions(result.questions);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadQuiz();
    return () => {
      isActive = false;
    };
  }, [lessonId, reloadKey]);

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorMessage("");
    setGenerationFailed(false);

    try {
      const result = await generateQuiz(lessonId);
      setQuestions(result.questions);
      setSelectedAnswers({});
      setHasSubmitted(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setGenerationFailed(true);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleAnswerChange(questionIndex, option) {
    setSelectedAnswers((answers) => ({
      ...answers,
      [questionIndex]: option,
    }));
  }

  if (isLoading) {
    return (
      <section className="quiz-panel" aria-label="Knowledge check">
        <p className="quiz-status">
          <LoaderCircle size={17} className="quiz-spinner" aria-hidden="true" />
          Checking for a knowledge check...
        </p>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="quiz-panel" aria-label="Knowledge check">
        <div className="quiz-heading">
          <span className="quiz-icon" aria-hidden="true">
            <CircleHelp size={19} />
          </span>
          <div>
            <p className="quiz-kicker">QUICK REVIEW</p>
            <h4>Ready to check your understanding?</h4>
          </div>
        </div>
        {errorMessage && (
          <p className="quiz-error" role="alert">
            {errorMessage}
          </p>
        )}
        {errorMessage ? (
          <button
            className="quiz-secondary-button"
            type="button"
            onClick={
              generationFailed
                ? handleGenerate
                : () => setReloadKey((key) => key + 1)
            }
            disabled={isGenerating}
          >
            {generationFailed ? "Try again" : "Retry"}
          </button>
        ) : (
          <button
            className="quiz-generate-button"
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <LoaderCircle size={16} className="quiz-spinner" aria-hidden="true" />
            ) : (
              <Sparkles size={16} aria-hidden="true" />
            )}
            {isGenerating ? "Generating knowledge check..." : "Generate Knowledge Check"}
          </button>
        )}
      </section>
    );
  }

  const score = questions.reduce(
    (total, question, index) =>
      total + Number(selectedAnswers[index] === question.correct_answer),
    0,
  );

  return (
    <section className="quiz-panel" aria-label="Knowledge check">
      <div className="quiz-heading">
        <span className="quiz-icon" aria-hidden="true">
          <CircleHelp size={19} />
        </span>
        <div>
          <p className="quiz-kicker">QUICK REVIEW</p>
          <h4>Knowledge check</h4>
        </div>
      </div>

      <div className="quiz-questions">
        {questions.map((question, questionIndex) => (
          <fieldset className="quiz-question" key={question.id ?? questionIndex}>
            <legend>
              <span className="quiz-question-number">{questionIndex + 1}</span>
              {question.question}
            </legend>
            <div className="quiz-options">
              {question.options.map((option, optionIndex) => {
                const isCorrect = option === question.correct_answer;
                const isSelected = selectedAnswers[questionIndex] === option;
                const optionClass = [
                  "quiz-option",
                  hasSubmitted && isCorrect && "is-correct",
                  hasSubmitted && isSelected && !isCorrect && "is-incorrect",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <label className={optionClass} key={`${questionIndex}-${optionIndex}`}>
                    <input
                      type="radio"
                      name={`quiz-${lessonId}-${questionIndex}`}
                      value={option}
                      checked={isSelected}
                      onChange={() => handleAnswerChange(questionIndex, option)}
                      disabled={hasSubmitted}
                    />
                    <span>{option}</span>
                    {hasSubmitted && isCorrect && (
                      <Check size={16} aria-label="Correct answer" />
                    )}
                    {hasSubmitted && isSelected && !isCorrect && (
                      <X size={16} aria-label="Your answer was incorrect" />
                    )}
                  </label>
                );
              })}
            </div>
            {hasSubmitted && (
              <p className="quiz-explanation">
                <strong>Why:</strong> {question.explanation}
              </p>
            )}
          </fieldset>
        ))}
      </div>

      {errorMessage && (
        <p className="quiz-error" role="alert">
          {errorMessage}
        </p>
      )}
      {hasSubmitted ? (
        <p className="quiz-score" role="status">
          You got {score} of {questions.length} correct.
        </p>
      ) : (
        <button
          className="quiz-generate-button"
          type="button"
          onClick={() => setHasSubmitted(true)}
          disabled={Object.keys(selectedAnswers).length !== questions.length}
        >
          Submit Answers
        </button>
      )}
    </section>
  );
}
