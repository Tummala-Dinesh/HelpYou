import asyncio
import logging
import os
from pathlib import Path

import psycopg2
from dotenv import dotenv_values
from langchain_core.prompts import ChatPromptTemplate

from schemas import QuizResponse
from services.llm_service import gemini_llm


logger = logging.getLogger(__name__)


def get_db_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "ep-xyz" in database_url.lower():
        server_env = Path(__file__).resolve().parents[2] / "server" / ".env"
        database_url = dotenv_values(server_env).get("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured.")
    return psycopg2.connect(database_url)


def _load_lesson_context(lesson_id: str) -> str:
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT chunk_text
                FROM document_chunks
                WHERE lesson_id = %s
                ORDER BY id
                """,
                (lesson_id,),
            )
            chunks = [row[0] for row in cursor.fetchall()]
    finally:
        connection.close()

    return "\n\n".join(chunks).strip()


quiz_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """Create exactly three multiple-choice questions based on the lesson
context provided. Each question must have one correct answer, and
correct_answer must exactly match one option. Provide a concise explanation.
Return only the requested structured output.""",
        ),
        (
            "human",
            "Create a knowledge check for this lesson:\n\n{context}",
        ),
    ]
)

structured_quiz_llm = gemini_llm.with_structured_output(QuizResponse)
quiz_chain = quiz_prompt | structured_quiz_llm


def _fallback_quiz(lesson_title: str, topics_to_cover: list[str]) -> QuizResponse:
    title = lesson_title.strip() or "this lesson"
    topics = [topic.strip() for topic in topics_to_cover if topic.strip()]
    if not topics:
        topics = [title]

    questions = []
    question_templates = (
        "Which topic is explicitly included in {title}?",
        "Which subject should a learner review for {title}?",
        "Which item belongs to the lesson topics for {title}?",
    )
    for index in range(3):
        topic = topics[index % len(topics)]
        distractors = [
            f"A topic unrelated to {title}",
            f"An example outside {topic}",
            f"A subject not covered by {title}",
        ]
        options = [topic, *distractors[:3]]
        questions.append(
            {
                "question": question_templates[index].format(title=title),
                "options": options,
                "correct_answer": topic,
                "explanation": f"{topic} is listed as a topic for {title}.",
            }
        )
    return QuizResponse.model_validate({"questions": questions})


async def generate_lesson_quiz(
    lesson_id: str,
    lesson_title: str = "",
    topics_to_cover: list[str] | None = None,
    transcript: str = "",
) -> QuizResponse:
    topics = topics_to_cover or []
    context = transcript.strip()
    if not context:
        try:
            context = await asyncio.to_thread(_load_lesson_context, lesson_id)
        except Exception:
            logger.exception(
                "Could not load document chunks for lesson %s; using lesson metadata",
                lesson_id,
            )

    if not context:
        context = (
            f"Lesson title: {lesson_title or 'Untitled lesson'}\n"
            f"Topics to cover: {', '.join(topics) if topics else 'Not specified'}"
        )

    try:
        result = await quiz_chain.ainvoke({"context": context})
        if not isinstance(result, QuizResponse):
            raise TypeError("Gemini returned a result that is not a QuizResponse.")
        return result
    except Exception:
        logger.exception("LLM quiz generation failed for lesson %s", lesson_id)
        return _fallback_quiz(lesson_title, topics)
