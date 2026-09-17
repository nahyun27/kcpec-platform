from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.admin import require_admin
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.models.community import Notice, NoticeCategory, Post, PostCategory
from app.models.faq import Faq, FaqCategory
from app.models.order import Order, OrderStatus
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
    PostUpdate,
)
from app.schemas.faq import FaqRead

router = APIRouter(tags=["community"])


# ---------- faq (자주 묻는 질문) -----------------------------------------------


@router.get("/faq", response_model=list[FaqRead])
def list_faqs(
    category: FaqCategory | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Faq]:
    stmt = select(Faq).where(Faq.is_active.is_(True))
    if category is not None:
        stmt = stmt.where(Faq.category == category)
    return list(db.scalars(stmt.order_by(Faq.order_index, Faq.id)).all())


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
def get_notice(
    notice_id: int,
    db: Session = Depends(get_db),
    count_view: bool = Query(default=True),
) -> NoticeDetail:
    notice = db.get(Notice, notice_id)
    if notice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="공지를 찾을 수 없습니다.")
    # 관리자 화면이 수정 폼에 내용을 채우려고 이 엔드포인트를 그대로
    # 재사용하면서, 오타 하나 고치려고 열어봐도 매번 조회수가 올라가고
    # 있었다 — count_view=false 로 호출하면 조회수를 건드리지 않는다
    # (2026-09, 버그 감사 중 발견).
    if count_view:
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
    current_user: User | None = Depends(get_current_user_optional),
) -> PaginatedPosts:
    base = select(Post)
    count_base = select(func.count(Post.id))
    if category is not None:
        base = base.where(Post.category == category)
        count_base = count_base.where(Post.category == category)
    # Q&A는 공개 게시판이 아니라 마이페이지 1:1 문의다 — 본인 글만, 관리자는
    # 전체를 본다. 다른 카테고리(칼럼/후기)는 그대로 공개(2026-09 전환).
    if category == PostCategory.QNA:
        if current_user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다.")
        if not current_user.is_admin:
            base = base.where(Post.user_id == current_user.id)
            count_base = count_base.where(Post.user_id == current_user.id)
    elif category is None:
        # category 미지정(전체 조회) 시에도 QNA(1:1 문의)는 절대 새어나가면 안 됨.
        if current_user is None:
            base = base.where(Post.category != PostCategory.QNA)
            count_base = count_base.where(Post.category != PostCategory.QNA)
        elif not current_user.is_admin:
            visible = or_(Post.category != PostCategory.QNA, Post.user_id == current_user.id)
            base = base.where(visible)
            count_base = count_base.where(visible)
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
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    count_view: bool = Query(default=True),
    current_user: User | None = Depends(get_current_user_optional),
) -> PostDetail:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다.")
    # Q&A(1:1 문의)는 본인 또는 관리자만 조회 가능 — 다른 사람 글이 존재하는지
    # 자체를 노출하지 않기 위해 403이 아니라 404로 응답한다(2026-09).
    if post.category == PostCategory.QNA:
        is_owner = current_user is not None and current_user.id == post.user_id
        is_admin = current_user is not None and current_user.is_admin
        if not is_owner and not is_admin:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다.")
    # count_view=false 용도는 get_notice 와 동일 — 관리자가 수정하려고 열어볼
    # 때 조회수가 같이 올라가던 문제 수정.
    if count_view:
        post.view_count += 1
        db.commit()
        db.refresh(post)
    return PostDetail.model_validate(post)


@router.patch("/posts/{post_id}", response_model=PostDetail)
def update_own_post(
    post_id: int,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PostDetail:
    # 1:1 문의 작성자 본인이 자기 글을 고치는 용도 — 관리자용 수정은
    # /admin/posts/{id} 로 별도(관리자는 질문 내용을 고칠 수 없고 답변만 가능).
    post = db.get(Post, post_id)
    # 다른 사람 글 존재 여부를 노출하지 않기 위해 get_post 와 동일하게 404.
    if post is None or post.category != PostCategory.QNA or post.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="게시글을 찾을 수 없습니다.")
    if post.admin_reply is not None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="이미 답변이 달린 문의는 수정할 수 없습니다.",
        )
    if payload.title is not None:
        post.title = payload.title
    if payload.content is not None:
        post.content = payload.content
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
    # 후기는 실제 결제 완료한 강의에 대해서만 작성 가능 — course_id 만 있으면
    # 아무 강의에나 별점을 남길 수 있던 문제를 막는다.
    if payload.category == PostCategory.REVIEW:
        if payload.course_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, detail="후기를 작성할 강의를 선택해 주세요."
            )
        purchased = db.scalar(
            select(func.count(Order.id)).where(
                Order.user_id == current_user.id,
                Order.course_id == payload.course_id,
                Order.status == OrderStatus.PAID,
            )
        )
        if not purchased:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="결제 완료한 강의에 대해서만 후기를 작성할 수 있습니다.",
            )
        # author_name 으로 중복을 판별한다(REVIEW 는 author_name 이 항상
        # current_user.username — 바로 아래에서 강제) — 같은 사람이 같은
        # 강의에 후기를 몇 개든 반복 작성해 평균 별점을 마음대로 올리거나
        # 내릴 수 있었다(2026-09, 버그 감사 중 발견).
        already_reviewed = db.scalar(
            select(func.count(Post.id)).where(
                Post.category == PostCategory.REVIEW,
                Post.course_id == payload.course_id,
                Post.author_name == current_user.username,
            )
        )
        if already_reviewed:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="이미 이 강의에 후기를 작성하셨습니다.",
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
        course_id=payload.course_id if payload.category == PostCategory.REVIEW else None,
        rating=payload.rating,
        # 1:1 문의 소유자 — 본인/관리자만 조회 가능하게 하는 기준(2026-09).
        user_id=current_user.id if payload.category == PostCategory.QNA else None,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return PostDetail.model_validate(post)
