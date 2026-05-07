from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.course import CourseCategory


class LectureProgressItem(BaseModel):
    lecture_id: int
    watched_seconds: int
    last_position_sec: int
    is_completed: bool

    model_config = ConfigDict(from_attributes=True)


class EnrollmentStatus(BaseModel):
    enrollment_id: int
    course_id: int
    is_completed: bool
    completed_at: datetime | None
    overall_progress_pct: int
    lecture_progresses: list[LectureProgressItem]


class LectureProgressUpdate(BaseModel):
    watched_seconds: int = Field(ge=0)
    last_position_sec: int = Field(ge=0)
    is_completed: bool = False
    # 클라이언트가 영상에서 직접 감지한 duration. DB 의 lecture.duration_seconds
    # 가 0/누락이거나 더 작을 때 갱신 (일반 유저도 자기 강의 duration 반영 가능).
    duration_seconds: int | None = Field(default=None, ge=0)


class EnrollmentWithProgress(BaseModel):
    course_id: int
    course_title: str
    category: CourseCategory
    is_completed: bool
    overall_progress_pct: int
    has_quiz: bool = False
