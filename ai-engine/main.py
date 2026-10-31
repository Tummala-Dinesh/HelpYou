import asyncio
import logging
import os

import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    CourseSyllabus,
    EnrichLessonRequest,
    GenerateCourseRequest,
    GenerateQuizRequest,
    QuizResponse,
)
from services.course_generator import generate_syllabus
from services.quiz_generator import generate_lesson_quiz
from services.rag_service import chunk_and_embed_transcript
from services.youtube_service import (
    YouTubeVideo,
    get_video_transcript,
    search_youtube_video,
)

load_dotenv()

logger = logging.getLogger(__name__)

app = FastAPI(title="AI Course Builder AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-engine"}


@app.post("/api/generate-syllabus", response_model=CourseSyllabus)
async def generate_course_syllabus(
    request: GenerateCourseRequest,
) -> CourseSyllabus:
    try:
        return await generate_syllabus(request.topic, request.difficulty)
    except Exception as error:
        logger.exception("Syllabus generation failed")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate course syllabus: {error}",
        ) from error


@app.post("/api/generate-quiz", response_model=QuizResponse)
async def generate_quiz(request: GenerateQuizRequest) -> QuizResponse:
    try:
        return await generate_lesson_quiz(
            request.lesson_id,
            request.lesson_title or "",
            request.topics_to_cover or [],
            request.transcript or "",
        )
    except Exception as error:
        logger.exception("Quiz generation failed for lesson %s", request.lesson_id)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate lesson quiz: {error}",
        ) from error


def embed_transcript_in_background(
    course_id: str,
    lesson_id: str,
    transcript: str,
) -> None:
    try:
        chunk_and_embed_transcript(course_id, lesson_id, transcript)
    except Exception as error:
        print(
            f"Background transcript embedding failed for lesson {lesson_id}: "
            f"{error}",
            flush=True,
        )
        logger.exception(
            "Background transcript embedding failed for course %s, lesson %s",
            course_id,
            lesson_id,
        )


@app.post("/api/enrich-lesson")
async def enrich_lesson(
    request: EnrichLessonRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    try:
        video: YouTubeVideo = await search_youtube_video(request.search_query)
        transcript = await asyncio.to_thread(
            get_video_transcript,
            video["video_id"],
        )
        if transcript:
            background_tasks.add_task(
                embed_transcript_in_background,
                request.course_id,
                request.lesson_id,
                transcript,
            )

        return {
            "video_id": video["video_id"],
            "youtube_title": video["title"],
            "transcript": transcript,
        }
    except httpx.HTTPError as error:
        logger.exception("YouTube video search failed")
        raise HTTPException(
            status_code=502,
            detail="YouTube video search failed.",
        ) from error
    except ValueError as error:
        logger.exception("YouTube API returned an invalid response")
        raise HTTPException(
            status_code=502,
            detail="YouTube API returned an invalid response.",
        ) from error
    except Exception as error:
        logger.exception("Lesson enrichment failed")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to enrich lesson: {error}",
        ) from error


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
