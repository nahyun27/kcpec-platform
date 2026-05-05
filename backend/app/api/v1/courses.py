from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.storage import issue_stream_url
from app.models.course import Course, CourseCategory
from app.models.enrollment import Enrollment, LectureProgress
from app.models.lecture import Lecture
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.user import User
from app.schemas.course import (
    CourseDetail,
    CourseListItem,
    LectureItem,
    StreamUrlResponse,
)
from app.schemas.enrollment import (
    EnrollmentStatus,
    EnrollmentWithProgress,
    LectureProgressItem,
    LectureProgressUpdate,
)
from app.schemas.quiz import (
    OptionItem,
    QuestionItem,
    QuizDetail,
    QuizResult,
    QuizSubmit,
)

router = APIRouter(tags=["courses"])


# ---------- internal helpers ---------------------------------------------------


def _get_active_course(db: Session, course_id: int) -> Course:
    course = db.scalar(
        select(Course)
        .where(Course.id == course_id, Course.is_active.is_(True))
        .options(selectinload(Course.lectures))
    )
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")
    return course


def _get_enrollment(db: Session, user_id: int, course_id: int) -> Enrollment | None:
    return db.scalar(
        select(Enrollment)
        .where(Enrollment.user_id == user_id, Enrollment.course_id == course_id)
        .options(selectinload(Enrollment.progresses))
    )


def _calc_overall_progress(course: Course, progresses: list[LectureProgress]) -> int:
    active_lectures = [lec for lec in course.lectures if lec.is_active]
    if not active_lectures:
        return 0
    completed_ids = {p.lecture_id for p in progresses if p.is_completed}
    completed = sum(1 for lec in active_lectures if lec.id in completed_ids)
    return int(round(completed * 100 / len(active_lectures)))


def _has_passed_quiz(db: Session, enrollment_id: int) -> bool:
    return db.scalar(
        select(func.count(QuizAttempt.id)).where(
            QuizAttempt.enrollment_id == enrollment_id,
            QuizAttempt.is_passed.is_(True),
        )
    ) > 0


def _maybe_complete_enrollment(
    db: Session,
    course: Course,
    enrollment: Enrollment,
) -> None:
    if enrollment.is_completed:
        return
    overall = _calc_overall_progress(course, enrollment.progresses)
    if overall >= course.min_progress_pct and _has_passed_quiz(db, enrollment.id):
        enrollment.is_completed = True
        enrollment.completed_at = datetime.now(timezone.utc)


# ---------- public: course catalog --------------------------------------------


@router.get("/courses", response_model=list[CourseListItem])
def list_courses(
    category: CourseCategory | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Course]:
    stmt = select(Course).where(Course.is_active.is_(True)).order_by(Course.id.desc())
    if category is not None:
        stmt = stmt.where(Course.category == category)
    else:
        # 심리상담 프로그램은 강의가 아니라 상담 상품이므로 공개 강의 목록에서 제외.
        stmt = stmt.where(Course.category != CourseCategory.COUNSELING)
    return list(db.scalars(stmt).all())


@router.get("/courses/my-enrollments", response_model=list[EnrollmentWithProgress])
def list_my_enrollments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EnrollmentWithProgress]:
    enrollments = list(
        db.scalars(
            select(Enrollment)
            .where(Enrollment.user_id == current_user.id)
            .options(selectinload(Enrollment.progresses))
            .order_by(Enrollment.enrolled_at.desc())
        ).all()
    )
    if not enrollments:
        return []

    course_ids = [e.course_id for e in enrollments]
    courses_map = {
        c.id: c
        for c in db.scalars(
            select(Course)
            .where(Course.id.in_(course_ids))
            .options(selectinload(Course.lectures))
        ).all()
    }

    out: list[EnrollmentWithProgress] = []
    for e in enrollments:
        course = courses_map.get(e.course_id)
        if course is None:
            continue
        out.append(
            EnrollmentWithProgress(
                course_id=course.id,
                course_title=course.title,
                category=course.category,
                is_completed=e.is_completed,
                overall_progress_pct=_calc_overall_progress(course, e.progresses),
            )
        )
    return out


@router.get("/courses/{course_id}", response_model=CourseDetail)
def get_course(course_id: int, db: Session = Depends(get_db)) -> CourseDetail:
    course = _get_active_course(db, course_id)
    return CourseDetail(
        id=course.id,
        title=course.title,
        category=course.category,
        thumbnail_url=course.thumbnail_url,
        price=course.price,
        is_active=course.is_active,
        description=course.description,
        min_progress_pct=course.min_progress_pct,
        quiz_pass_score=course.quiz_pass_score,
        lectures=[
            LectureItem.model_validate(lec) for lec in course.lectures if lec.is_active
        ],
    )


# ---------- enrollment + progress ---------------------------------------------


@router.post(
    "/courses/{course_id}/enroll",
    response_model=EnrollmentStatus,
    status_code=status.HTTP_200_OK,
)
def enroll(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EnrollmentStatus:
    course = _get_active_course(db, course_id)
    enrollment = _get_enrollment(db, current_user.id, course_id)
    if enrollment is None:
        enrollment = Enrollment(user_id=current_user.id, course_id=course.id)
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)
    return _to_status(course, enrollment)


@router.get("/courses/{course_id}/progress", response_model=EnrollmentStatus)
def get_progress(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EnrollmentStatus:
    course = _get_active_course(db, course_id)
    enrollment = _get_enrollment(db, current_user.id, course_id)
    if enrollment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="수강 등록 내역이 없습니다.")
    return _to_status(course, enrollment)


def _to_status(course: Course, enrollment: Enrollment) -> EnrollmentStatus:
    return EnrollmentStatus(
        enrollment_id=enrollment.id,
        course_id=course.id,
        is_completed=enrollment.is_completed,
        completed_at=enrollment.completed_at,
        overall_progress_pct=_calc_overall_progress(course, enrollment.progresses),
        lecture_progresses=[LectureProgressItem.model_validate(p) for p in enrollment.progresses],
    )


@router.patch("/lectures/{lecture_id}/progress", response_model=EnrollmentStatus)
def update_lecture_progress(
    lecture_id: int,
    payload: LectureProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EnrollmentStatus:
    lecture = db.get(Lecture, lecture_id)
    if lecture is None or not lecture.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")

    course = _get_active_course(db, lecture.course_id)
    enrollment = _get_enrollment(db, current_user.id, course.id)
    if enrollment is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="수강 등록이 필요합니다.")

    progress = next((p for p in enrollment.progresses if p.lecture_id == lecture_id), None)
    if progress is None:
        progress = LectureProgress(
            enrollment_id=enrollment.id,
            lecture_id=lecture_id,
        )
        db.add(progress)
        enrollment.progresses.append(progress)

    # 새로 생성된 LectureProgress 는 flush 전까지 column default(0)가 적용되지 않아
    # 속성이 None 인 채로 max() 에 들어가 TypeError → 500 이 발생하던 케이스를 방어.
    progress.watched_seconds = max(
        progress.watched_seconds or 0, payload.watched_seconds or 0
    )
    progress.last_position_sec = max(
        progress.last_position_sec or 0, payload.last_position_sec or 0
    )
    if payload.is_completed:
        progress.is_completed = True

    _maybe_complete_enrollment(db, course, enrollment)
    db.commit()
    db.refresh(enrollment)
    return _to_status(course, enrollment)


# ---------- streaming ----------------------------------------------------------


@router.get("/lectures/{lecture_id}/stream-url", response_model=StreamUrlResponse)
def get_stream_url(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamUrlResponse:
    lecture = db.get(Lecture, lecture_id)
    if lecture is None or not lecture.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="강의를 찾을 수 없습니다.")

    enrollment_exists = db.scalar(
        select(func.count(Enrollment.id)).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == lecture.course_id,
        )
    )
    if not enrollment_exists:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="수강 등록이 필요합니다.")

    url, expires = issue_stream_url(lecture.video_url, lecture.id)
    return StreamUrlResponse(url=url, expires_in=expires)


# ---------- quiz ---------------------------------------------------------------


def _get_course_quiz(db: Session, course_id: int) -> Quiz:
    quiz = db.scalar(
        select(Quiz)
        .where(Quiz.course_id == course_id)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
    )
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="퀴즈가 등록되지 않았습니다.")
    return quiz


@router.get("/courses/{course_id}/quiz", response_model=QuizDetail)
def get_quiz(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizDetail:
    course = _get_active_course(db, course_id)
    if _get_enrollment(db, current_user.id, course.id) is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="수강 등록이 필요합니다.")

    quiz = _get_course_quiz(db, course.id)
    return QuizDetail(
        quiz_id=quiz.id,
        pass_score=course.quiz_pass_score,
        questions=[
            QuestionItem(
                id=q.id,
                question_text=q.question_text,
                options=[OptionItem(id=o.id, option_text=o.option_text) for o in q.options],
            )
            for q in quiz.questions
        ],
    )


@router.post("/courses/{course_id}/quiz/submit", response_model=QuizResult)
def submit_quiz(
    course_id: int,
    payload: QuizSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizResult:
    course = _get_active_course(db, course_id)
    enrollment = _get_enrollment(db, current_user.id, course.id)
    if enrollment is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="수강 등록이 필요합니다.")

    quiz = _get_course_quiz(db, course.id)
    questions = quiz.questions
    if not questions:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="등록된 문제가 없습니다.")

    correct_option_ids = {
        q.id: next((o.id for o in q.options if o.is_correct), None) for q in questions
    }

    correct_count = 0
    for q in questions:
        chosen = payload.answers.get(q.id)
        if chosen is not None and chosen == correct_option_ids[q.id]:
            correct_count += 1

    score = int(round(correct_count * 100 / len(questions)))
    is_passed = score >= course.quiz_pass_score

    db.add(QuizAttempt(enrollment_id=enrollment.id, score=score, is_passed=is_passed))

    if is_passed:
        # Re-fetch progresses fresh for completion check, then maybe finalize.
        db.flush()
        _maybe_complete_enrollment(db, course, enrollment)

    db.commit()

    return QuizResult(
        score=score,
        is_passed=is_passed,
        pass_score=course.quiz_pass_score,
        correct_count=correct_count,
        total_count=len(questions),
    )
