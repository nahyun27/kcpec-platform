from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.community import NoticeCategory, PostCategory


class NoticeListItem(BaseModel):
    id: int
    title: str
    category: NoticeCategory
    is_pinned: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NoticeDetail(NoticeListItem):
    content: str
    file_url: str | None
    view_count: int
    updated_at: datetime


class NoticeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    category: NoticeCategory
    file_url: str | None = None
    is_pinned: bool = False


class PostListItem(BaseModel):
    id: int
    title: str
    category: PostCategory
    author_name: str
    view_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PostDetail(PostListItem):
    content: str


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    category: PostCategory
    author_name: str = Field(default="익명", max_length=50)


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
