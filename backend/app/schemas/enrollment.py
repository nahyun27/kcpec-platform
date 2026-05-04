from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
