import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import "./App.css";
import CourseGenerator from "./components/CourseGenerator.jsx";
import CourseViewer from "./components/CourseViewer.jsx";

function App() {
  const [currentCourse, setCurrentCourse] = useState(null);

  if (!currentCourse) {
    return <CourseGenerator onCourseGenerated={setCurrentCourse} />;
  }

  return (
    <>
      <CourseViewer course={currentCourse} />
      <button
        className="another-course-button"
        type="button"
        onClick={() => setCurrentCourse(null)}
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Generate another course
      </button>
    </>
  );
}

export default App;
