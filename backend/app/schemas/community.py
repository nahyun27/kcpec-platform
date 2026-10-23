from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.community import NoticeCategory, PostCategory


class NoticeListItem(BaseModel):
    id: int
    title: str
    category: NoticeCategory
    author_name: str
    is_pinned: bool
    view_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NoticeDetail(NoticeListItem):
    content: str
    file_url: str | None
    updated_at: datetime


class NoticeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    category: NoticeCategory
    author_name: str = Field(default="한국범죄예방교육센터", max_length=50)
    file_url: str | None = None
    is_pinned: bool = False


class PostListItem(BaseModel):
    id: int
    title: str
    category: PostCategory
    author_name: str
    course_category: str | None
    course_id: int | None = None
    rating: int = 5
    view_count: int
    created_at: datetime
    # review 카테고리 응답에만 채워서 내려준다 (다른 카테고리는 None).
    content: str | None = None
    # 관리자 답변 (Q&A 에만 의미 있음)
    admin_reply: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PostDetail(PostListItem):
    content: str  # type: ignore[assignment]


class PostAdminReply(BaseModel):
    reply: str = Field(min_length=1)


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1)


class PostCreate(BaseModel):
    title: str = Field(default="", max_length=255)
    # 후기는 별점만 남겨도 된다(글은 선택, 2026-10). 다른 글은 아래 create_post 에서 필수 검사.
    content: str = Field(default="", max_length=5000)
    category: PostCategory
    author_name: str = Field(default="익명", max_length=50)
    course_category: str | None = Field(default=None, max_length=50)
    course_id: int | None = None
    rating: int = Field(default=5, ge=1, le=5)


class PaginatedNotices(BaseModel):
    items: list[NoticeListItem]
    total: int
    page: int
    size: int


class PaginatedPosts(BaseModel):
    items: list[PostListItem]
    total: int
    page: int
    size: int


# ---------- 후기 별점 요약 (홈 배지·후기 창·강의 페이지, 2026-10) ----------


class ReviewItem(BaseModel):
    # 작성자는 공개하지 않는다(완전 익명, 2026-10 고객사 요청).
    id: int
    rating: int
    content: str
    course_id: int | None = None
    course_title: str | None = None
    # 강의 분류(Course.category) — 사건별 칩 필터와 같은 값.
    category: str | None = None
    created_at: datetime


class ReviewStat(BaseModel):
    key: str
    count: int
    average: float


class ReviewCourseStat(BaseModel):
    course_id: int
    course_title: str
    category: str
    count: int
    average: float


class ReviewSummary(BaseModel):
    count: int
    # 소수 둘째 자리까지(예: 4.98) — 한 자리로 반올림하면 5.0 이 되어버려
    # 오히려 덜 믿기므로 그대로 보여준다(고객사 요청).
    average: float
    # "5" → 개수 … "1" → 개수
    distribution: dict[str, int]
    categories: list[ReviewStat]
    courses: list[ReviewCourseStat]
    recent: list[ReviewItem]


class PaginatedReviews(BaseModel):
    items: list[ReviewItem]
    total: int
    page: int
    size: int


class ReviewPromptState(BaseModel):
    show: bool
    course_id: int | None = None
    course_title: str | None = None
    course_category: str | None = None
