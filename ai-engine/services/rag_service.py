import logging
import os
from pathlib import Path

import psycopg2
from dotenv import dotenv_values, load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

logger = logging.getLogger(__name__)
api_key = (
    os.getenv("GOOGLE_API_KEY")
    or os.getenv("GEMINI_API_KEY")
    or os.getenv("LLM_API_KEY")
)
if api_key:
    os.environ["GOOGLE_API_KEY"] = api_key

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/text-embedding-004",
    google_api_key=api_key,
)


def get_db_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "ep-xyz" in database_url.lower():
        server_env = Path(__file__).resolve().parents[2] / "server" / ".env"
        database_url = dotenv_values(server_env).get("DATABASE_URL")

    if not database_url:
        raise ValueError("DATABASE_URL is not configured.")
    return psycopg2.connect(database_url)


def chunk_and_embed_transcript(
    course_id: str,
    lesson_id: str,
    transcript: str,
) -> None:
    if not transcript.strip():
        return

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
    )
    chunks = splitter.split_text(transcript)

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            for chunk in chunks:
                embedding_list = embeddings.embed_query(chunk)
                cursor.execute(
                    """
                    INSERT INTO document_chunks
                        (course_id, lesson_id, source_type, chunk_text, embedding)
                    VALUES (%s, %s, 'youtube_transcript', %s, %s::vector)
                    """,
                    (
                        course_id,
                        lesson_id,
                        chunk,
                        str(embedding_list),
                    ),
                )
        connection.commit()
        logger.info(
            "Stored %d transcript chunks for course %s, lesson %s",
            len(chunks),
            course_id,
            lesson_id,
        )
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
