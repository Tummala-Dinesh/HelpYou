# Product Requirements Document (PRD): AI Course Builder with RAG

## 1. Project Overview & Objective
**AI Course Builder** is an intelligent, full-stack web application that transforms a simple user prompt (and optional reference documents) into a comprehensive, structured multimedia course. Each generated course includes modular chapters, detailed educational content, relevant embedded YouTube videos, and interactive quizzes to test comprehension.

**Portfolio Goal:** This project is explicitly architected to showcase advanced **Python LLM orchestration, Structured Outputs, and Retrieval-Augmented Generation (RAG)** skills, seamlessly integrated into a modern JavaScript full-stack web environment (React, Node.js/Express, PostgreSQL).

---

## 2. System Architecture & Tech Stack
To showcase both full-stack web development and Python AI engineering, this project uses a **Microservice/Hybrid Architecture**:

### A. Frontend (Client Tier)
* **Framework:** React (Vite)
* **Styling:** Modern CSS3 (Custom variables, Flexbox/Grid, responsive design) & HTML5
* **HTTP Client:** Axios (for communicating with the Node.js API)
* **Key Features:** Course generation wizard, PDF/Reference upload for RAG, split-screen interactive course player, embedded YouTube iframe player, interactive quiz component with instant grading.

### B. Core Web Backend (API Gateway & Business Logic Tier)
* **Runtime & Framework:** Node.js & Express.js
* **HTTP Client:** Axios (for internal service-to-service calls to the Python AI Engine)
* **Responsibilities:**
  * User state & course CRUD operations.
  * Handling file uploads (passing documents to the Python service).
  * Communicating with the PostgreSQL database (storing generated courses, modules, lessons, and quiz scores).
  * Acting as a proxy/orchestrator between the React frontend and the Python AI microservice.

### C. AI & RAG Engine (Intelligence Tier - *Core Portfolio Showcase*)
* **Language & Framework:** Python 3.10+, FastAPI (high-performance API for LLM operations)
* **LLM & Orchestration:** LangChain or LlamaIndex + OpenAI API / Gemini API / Groq
* **Validation:** Pydantic (forcing strict JSON schema outputs from the LLM)
* **RAG Pipeline:**
  * **Document Loaders:** `PyPDF2` / `LangChain DocumentLoaders` (for user-uploaded syllabi/textbooks) & `youtube-transcript-api` (to extract transcripts from fetched YouTube videos).
  * **Chunking & Embeddings:** `RecursiveCharacterTextSplitter` + OpenAI/HuggingFace Embeddings.
  * **Vector Storage:** `pgvector` (PostgreSQL extension) or `ChromaDB` for semantic search.
* **External APIs:** YouTube Data API v3 (or `youtubesearchpython`) to dynamically find the best educational videos per lesson.

### D. Database Tier
* **Database:** PostgreSQL
* **Vector Extension:** `pgvector` (allows storing both relational course data and vector embeddings in a single database instance).

---

## 3. Core Features & RAG Showcase Strategy

### Feature 1: Prompt-to-Outline Generation (LLM Structured Output)
* **User Flow:** User enters a topic (e.g., *"Advanced Asynchronous Programming in Python"*), selects difficulty (*Beginner, Intermediate, Advanced*), and optionally uploads a reference PDF/syllabus.
* **AI Showcase:** If a PDF is uploaded, the Python service chunks and embeds the document into the Vector DB. The LLM uses RAG to generate a structured course syllabus (Modules & Lesson Titles) grounded in the uploaded material.

### Feature 2: Automated YouTube Curation & Transcript RAG
* **User Flow:** Once the outline is approved, the system generates the full content for each lesson.
* **AI Showcase (Dual-RAG):**
  1. For each lesson, the Python engine generates an optimized YouTube search query and fetches the top educational video.
  2. **Transcript RAG:** The Python service pulls the transcript of that specific YouTube video, chunks/embeds it, and combines it with any uploaded PDF context.
  3. The LLM synthesizes comprehensive written lesson notes *directly aligned with what is spoken in the video* and the reference docs.

### Feature 3: Context-Grounded Quiz Generation
* **User Flow:** At the end of each module/lesson, the user takes a 3-to-5 question multiple-choice quiz.
* **AI Showcase:** Instead of generic hallucinated questions, the Python RAG pipeline retrieves the exact chunks from the generated lesson notes and video transcript to generate factual, context-specific questions, options, correct answers, and detailed explanations.

### Feature 4: Interactive Course Player & Progress Tracking
* **User Flow:** A clean dashboard where users can view their generated courses, watch the embedded YouTube video, read the AI-synthesized notes side-by-side, take quizzes, and track completion percentage stored in PostgreSQL.

---

## 4. Database Schema (PostgreSQL)

```sql
-- 1. Courses Table
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    topic_prompt TEXT NOT NULL,
    difficulty VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Modules Table (Chapters)
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    module_order INTEGER NOT NULL
);

-- 3. Lessons Table
CREATE TABLE lessons (
    id SERIAL PRIMARY KEY,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    lesson_order INTEGER NOT NULL,
    content_markdown TEXT, -- Generated via RAG
    youtube_video_id VARCHAR(50),
    youtube_video_title VARCHAR(255),
    is_completed BOOLEAN DEFAULT FALSE
);

-- 4. Quizzes Table
CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of 4 strings
    correct_option_index INTEGER NOT NULL,
    explanation TEXT
);

-- 5. RAG Document Chunks (using pgvector)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE document_chunks (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    source_type VARCHAR(50), -- 'pdf_upload' or 'youtube_transcript'
    chunk_text TEXT NOT NULL,
    embedding vector(1536) -- Dimension depends on embedding model
);
```

---

## 5. API Endpoints Specification

### Node.js / Express Backend (`Port: 5000`)
* `POST /api/courses/generate-outline` -> Uploads optional PDF + prompt, calls Python `/ai/outline`, returns editable syllabus.
* `POST /api/courses/create-full` -> Saves approved outline to Postgres, triggers Python `/ai/generate-lesson` for each lesson, saves everything to DB.
* `GET /api/courses` -> Fetches all saved courses from Postgres.
* `GET /api/courses/:id` -> Fetches full course tree (modules, lessons, quizzes).
* `PATCH /api/lessons/:id/complete` -> Marks a lesson as completed.
* `POST /api/quizzes/generate` -> Generates a lesson quiz through the AI engine and saves its questions to Postgres.
* `GET /api/quizzes/:lessonId` -> Fetches saved quiz questions for a lesson.

### Python FastAPI AI Microservice (`Port: 8000`)
* `POST /ai/ingest-document` -> Parses PDF, chunks text, generates embeddings, stores in `document_chunks`.
* `POST /ai/generate-outline` -> Uses RAG (if document exists) + LLM with Pydantic structured output to return JSON course tree.
* `POST /ai/generate-lesson-content` -> Searches YouTube, extracts video ID + transcript, runs RAG over transcript + docs, returns Markdown lesson notes + JSON Quiz array.
* `POST /api/generate-quiz` -> Retrieves a lesson's transcript chunks and generates three structured multiple-choice questions.

---

## 6. Recommended Folder Structure (Monorepo for VS Code Copilot)
Keeping all three parts in a single root repository makes it very easy for **VS Code Copilot Agent Mode** to read `PRD.md` and understand the types and API contracts across services.

```text
ai-course-builder/
│
├── PRD.md                     # Reference file for Copilot Agent
├── docker-compose.yml         # Optional: For running PostgreSQL + pgvector easily
│
├── ai-service/                # PYTHON LLM & RAG ENGINE
│   ├── .env
│   ├── requirements.txt
│   ├── main.py                # FastAPI entry point
│   ├── schemas.py             # Pydantic models for Structured LLM Outputs
│   ├── rag_pipeline.py        # Document chunking, embedding, & retrieval logic
│   ├── youtube_service.py     # YouTube search & transcript extraction
│   └── llm_generator.py       # Prompt templates & LangChain/LLM calls
│
├── backend/                   # NODE.JS & EXPRESS API
│   ├── .env
│   ├── package.json
│   ├── server.js
│   ├── db/
│   │   ├── index.js           # pg pool connection
│   │   └── init.sql           # Database tables initialization
│   └── routes/
│       └── courseRoutes.js    # Express routes using Axios to call Python service
│
└── frontend/                  # REACT (VITE) + HTML/CSS
    ├── package.json
    ├── index.html
    └── src/
        ├── api/axiosConfig.js
        ├── App.jsx
        ├── styles/
        └── components/
            ├── CourseGenerator.jsx
            ├── CoursePlayer.jsx
            ├── VideoEmbed.jsx
            └── QuizModule.jsx
```

---

## 7. Step-by-Step Implementation Roadmap (Copilot Agent Prompts)
We will build this step-by-step. Here is our sequence of milestones:

* **Phase 1 (Prompt 1): Project Scaffolding & PostgreSQL Setup**
  * Set up the directory structure, initialize the PostgreSQL database schema (including `pgvector`), and verify DB connection.
* **Phase 2 (Prompt 2): Python AI Engine - Core Setup & Structured Course Outline**
  * Build the FastAPI server, Pydantic schemas, and the LLM chain that turns a user prompt into a strict JSON course syllabus.
* **Phase 3 (Prompt 3): Python RAG Pipeline & YouTube Transcript Integration**
  * Implement PDF ingestion, vector embeddings, YouTube video search, transcript extraction, and RAG-based lesson + quiz generation.
* **Phase 4 (Prompt 4): Node.js & Express Orchestration Backend**
  * Build the Express API that connects to PostgreSQL and uses `axios` to communicate with our Python AI microservice.
* **Phase 5 (Prompt 5): React Frontend - Course Builder & Interactive Player**
  * Create the UI with React, HTML, and clean CSS to generate courses, watch embedded videos, read markdown notes, and take interactive quizzes.