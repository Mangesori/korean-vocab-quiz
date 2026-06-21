import { Navigate } from "react-router-dom";

const DEMO_QUIZ_ID = "f879fc3d-4d30-4559-ad1b-8e2ea71c29ef";
const DEMO_SHARE_TOKEN = "namu-korean-demo";

export default function QuizExample() {
  return (
    <Navigate
      to={`/quiz/${DEMO_QUIZ_ID}/take?share=${DEMO_SHARE_TOKEN}&name=${encodeURIComponent("맛보기")}`}
      replace
    />
  );
}
