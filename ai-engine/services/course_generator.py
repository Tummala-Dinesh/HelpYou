from langchain_core.prompts import ChatPromptTemplate

from schemas import CourseSyllabus
from services.llm_service import gemini_llm

syllabus_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are an expert curriculum designer. Create an engaging, coherent,
well-sequenced course syllabus for the requested topic and learner difficulty.
Break the course into logically ordered modules and lessons. Give every module
and lesson a clear title, each module a concise summary, and each lesson a
numbered list of specific topics to cover. Ensure the scope and terminology are
appropriate for the specified difficulty. Return only content that conforms to
the requested structured output schema.""",
        ),
        (
            "human",
            "Design a course about {topic} for {difficulty} learners.",
        ),
    ]
)

structured_syllabus_llm = gemini_llm.with_structured_output(CourseSyllabus)
syllabus_chain = syllabus_prompt | structured_syllabus_llm


async def generate_syllabus(topic: str, difficulty: str) -> CourseSyllabus:
    result = await syllabus_chain.ainvoke(
        {"topic": topic, "difficulty": difficulty}
    )
    if not isinstance(result, CourseSyllabus):
        raise TypeError("Gemini returned a result that is not a CourseSyllabus.")
    return result