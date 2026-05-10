from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.course import CourseCategory


class LectureItem(BaseModel):
    id: int
    title: str
    order_index: int
    duration_seconds: int

    model_config = ConfigDict(from_attributes=True)


class CourseListItem(BaseModel):
    id: int
    title: str
    category: CourseCategory
    thumbnail_url: str | None
    price: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class CourseDetail(CourseListItem):
    description: str | None
    min_progress_pct: int
    quiz_pass_score: int
    lectures: list[LectureItem]
    has_quiz: bool = False


class StreamUrlResponse(BaseModel):
    url: str
    expires_in: int


class CourseReviewItem(BaseModel):
    id: int
    content: str
    created_at: datetime
    # 작성자명 마스킹된 형태 (예: "김**"). 클라이언트에 원본 노출 안 함.
    author_name: str
    rating: int
