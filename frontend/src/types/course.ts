export const COURSE_CATEGORIES = [
  "준법",
  "음주",
  "성범죄",
  "성매매",
  "디지털성범죄",
  "마약",
  "도박",
  "피싱",
  "재산범죄",
  "스토킹",
  "학교폭력",
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export type CourseListItem = {
  id: number;
  title: string;
  category: CourseCategory;
  thumbnail_url: string | null;
  price: number;
  is_active: boolean;
};

export type LectureItem = {
  id: number;
  title: string;
  order_index: number;
  duration_seconds: number;
};

export type CourseDetail = CourseListItem & {
  description: string | null;
  min_progress_pct: number;
  quiz_pass_score: number;
  lectures: LectureItem[];
  has_quiz: boolean;
};

export type LectureProgressItem = {
  lecture_id: number;
  watched_seconds: number;
  last_position_sec: number;
  is_completed: boolean;
};

export type EnrollmentStatus = {
  enrollment_id: number;
  course_id: number;
  is_completed: boolean;
  completed_at: string | null;
  overall_progress_pct: number;
  lecture_progresses: LectureProgressItem[];
};

export type LectureProgressUpdate = {
  watched_seconds: number;
  last_position_sec: number;
  is_completed?: boolean;
  // 클라이언트가 감지한 영상 길이. 백엔드가 더 큰 값일 때만 lecture.duration_seconds 갱신.
  duration_seconds?: number;
};

export type StreamUrlResponse = {
  url: string;
  expires_in: number;
};

export type CourseReview = {
  id: number;
  content: string;
  created_at: string;
  // 마스킹된 작성자명 (예: "김**")
  author_name: string;
  rating: number;
};

export type QuizOptionItem = {
  id: number;
  option_text: string;
};

export type QuizQuestionItem = {
  id: number;
  question_text: string;
  options: QuizOptionItem[];
};

export type QuizDetail = {
  quiz_id: number;
  pass_score: number;
  questions: QuizQuestionItem[];
};

export type QuizResult = {
  score: number;
  is_passed: boolean;
  pass_score: number;
  correct_count: number;
  total_count: number;
};
