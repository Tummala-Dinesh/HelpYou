import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

export async function generateCourse(topic, difficulty) {
  const response = await api.post("/courses/generate", { topic, difficulty });
  return response.data;
}

export async function getCourse(id) {
  const response = await api.get(`/courses/${encodeURIComponent(id)}`);
  return response.data;
}

export async function getQuiz(lessonId) {
  const response = await api.get(
    `/quizzes/${encodeURIComponent(lessonId)}`,
  );
  return response.data;
}

export async function generateQuiz(lessonId) {
  const response = await api.post("/quizzes/generate", { lessonId });
  return response.data;
}
