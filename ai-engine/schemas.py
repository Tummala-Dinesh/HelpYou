from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class LessonSchema(StrictSchema):
    title: str = Field(min_length=1)
    lesson_order: int
    topics_to_cover: list[str]


class ModuleSchema(StrictSchema):
    title: str = Field(min_length=1)
    module_order: int
    summary: str
    lessons: list[LessonSchema]


class CourseSyllabus(StrictSchema):
    course_title: str = Field(min_length=1)
    difficulty: str = Field(min_length=1)
    modules: list[ModuleSchema]


class GenerateCourseRequest(StrictSchema):
    topic: str = Field(min_length=1)
    difficulty: str = Field(min_length=1)


class EnrichLessonRequest(StrictSchema):
    course_id: str = Field(min_length=1)
    lesson_id: str = Field(min_length=1)
    search_query: str = Field(min_length=1)


class QuizQuestion(StrictSchema):
    question: str = Field(min_length=1)
    options: list[str] = Field(min_length=2)
    correct_answer: str = Field(min_length=1)
    explanation: str = Field(min_length=1)


class QuizResponse(StrictSchema):
    questions: list[QuizQuestion] = Field(min_length=3, max_length=3)


class GenerateQuizRequest(StrictSchema):
    lesson_id: str = Field(min_length=1)
    lesson_title: Optional[str] = ""
    topics_to_cover: Optional[list[str]] = Field(default_factory=list)
    transcript: Optional[str] = ""