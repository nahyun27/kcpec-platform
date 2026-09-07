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
    description: str | None = None
    category: CourseCategory
    thumbnail_url: str | None
    price: int
    # 할인 전 정가 — None 이거나 price 이하면 할인 아님(프론트에서 미노출).
    original_price: int | None = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class CourseDetail(CourseListItem):
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


class PaginatedCourseReviews(BaseModel):
    items: list[CourseReviewItem]
    total: int
    page: int
    size: int
    # 전체 후기 평균 별점 (소수 첫째 자리 반올림). 후기가 없으면 None.
    average_rating: float | None = None
