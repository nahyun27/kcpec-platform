from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.community import Notice, NoticeCategory, Post, PostCategory
from app.models.user import User
from app.schemas.community import (
    NoticeCreate,
    NoticeDetail,
    NoticeListItem,
    PaginatedNotices,
    PaginatedPosts,
    PostCreate,
    PostDetail,
    PostListItem,
)

router = APIRouter(tags=["community"])


# ---------- notices (공지사항/자료실) -----------------------------------------


@router.get("/notices", response_model=PaginatedNotices)
def list_notices(
    category: NoticeCategory | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedNotices:
    base = select(Notice)
    count_base = select(func.count(Notice.id))
    if category is not None:
        base = base.where(Notice.category == category)
        count_base = count_base.where(Notice.category == category)
    total = db.scalar(count_base) or 0
    items = list(
        db.scalars(
            base.order_by(Notice.is_pinned.desc(), Notice.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        ).all()
    )
    return PaginatedNotices(
        items=[NoticeListItem.model_validate(n) for n in items],
        total=total,
        page=page,
        size=size,
    )


@router.get("/notices/{notice_id}", response_model=NoticeDetail)
def get_notice(notice_id: int, db: Session = Depends(get_db)) -> NoticeDetail:
    notice = db.get(Notice, notice_id)
    if notice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="공지를 찾을 수 없습니다.")
    notice.view_count += 1
    db.commit()
    db.refresh(notice)
    return NoticeDetail.model_validate(notice)


@router.post(
    "/notices",
    response_model=NoticeDetail,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_notice(payload: NoticeCreate, db: Session = Depends(get_db)) -> NoticeDetail:
    notice = Notice(**payload.model_dump())
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return NoticeDetail.model_validate(notice)


# ---------- posts (Q&A / 칼럼 / 후기) -----------------------------------------


@router.get("/posts", response_model=PaginatedPosts)
def list_posts(
    category: PostCategory | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedPosts:
    base = select(Post)
    count_base = select(func.count(Post.id))
    if category is not None:
        base = base.where(Post.category == category)
        count_base = count_base.where(Post.category == category)
    total = db.scalar(count_base) or 0
    items = list(
        db.scalars(
            base.order_by(Post.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        ).all()
    )
    # review 카테고리 응답에만 본문을 포함 (별점 + 본문 한번에 노출용).
    # Q&A 는 list 단계에서 본문 + 관리자 답변까지 함께 보여줘야 하므로 본문 포함.
    # 그 외(column) 는 list 응답 크기를 줄이기 위해 content=None 으로 마스킹.
    def to_dto(p: Post) -> PostListItem:
        dto = PostListItem.model_validate(p)
        if p.category not in (PostCategory.REVIEW, PostCategory.QNA):
            dto.content = None
        return dto

    return PaginatedPosts(
        items=[to_dto(p) for p in items],
        total=total,
        page=page,
        size=size,
    )


@router.get("/posts/{post_id}", response_model=PostDetail)
def get_post(post_id: int, db: Session = Depends(get_db)) -> PostDetail:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다.")
    post.view_count += 1
    db.commit()
    db.refresh(post)
    return PostDetail.model_validate(post)


@router.post(
    "/posts",
    response_model=PostDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PostDetail:
    if payload.category == PostCategory.COLUMN and not current_user.is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="전문가 칼럼은 관리자만 작성할 수 있습니다.",
        )
    # author_name 우선순위:
    # - 칼럼: payload (관리자가 지정한 전문가명) 우선, 없으면 "관리자"
    # - 그 외(QNA, REVIEW): 항상 current_user.username — 사용자가 임의로 "익명"
    #   으로 보내도 무시 (스키마 default 가 "익명" 인 데서 오는 누수 방어).
    if payload.category == PostCategory.COLUMN:
        author = payload.author_name.strip() if payload.author_name else ""
        if not author or author == "익명":
            author = "관리자"
    else:
        author = current_user.username
    post = Post(
        title=payload.title,
        content=payload.content,
        category=payload.category,
        author_name=author,
        course_category=payload.course_category,
        rating=payload.rating,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return PostDetail.model_validate(post)
