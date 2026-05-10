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


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
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
