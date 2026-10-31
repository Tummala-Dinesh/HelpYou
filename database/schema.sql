CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty VARCHAR(50),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    module_order INT NOT NULL,
    summary TEXT
);

CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lesson_order INT NOT NULL,
    topics_to_cover JSONB,
    content_markdown TEXT,
    youtube_video_id VARCHAR(50),
    youtube_title TEXT,
    youtube_transcript TEXT
);

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS topics_to_cover JSONB;

CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    quiz_order INT NOT NULL DEFAULT 0
);

ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS quiz_order INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    source_type VARCHAR(50),
    chunk_text TEXT NOT NULL,
    metadata JSONB,
    embedding vector(768)
);
