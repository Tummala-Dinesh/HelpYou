import os

from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI

api_key = (
    os.getenv("GOOGLE_API_KEY")
    or os.getenv("GEMINI_API_KEY")
    or os.getenv("LLM_API_KEY")
)
if api_key:
    os.environ["GOOGLE_API_KEY"] = api_key

gemini_llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite",
    google_api_key=api_key,
    temperature=0.3,
)