from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.counseling import CounselingStatus
from app.models.course import CourseCategory
from app.models.order import OrderStatus, OrderType, PaymentMethod


class AdminUser(BaseModel):
    id: int
    username: str
    email: EmailStr
    birth_date: date | None
    is_active: bool
    is_admin: bool
    created_at: datetime
    enrollment_count: int = 0
    payment_count: int = 0
    total_payment: int = 0

    model_config = ConfigDict(from_attributes=True)


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: CourseCategory
    price: int = Field(ge=0, default=0)
    thumbnail_url: str | None = None
    min_progress_pct: int = Field(ge=0, le=100, default=90)
    quiz_pass_score: int = Field(ge=0, le=100, default=70)


class CoursePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: CourseCategory | None = None
    price: int | None = Field(default=None, ge=0)
    thumbnail_url: str | None = None
    min_progress_pct: int | None = Field(default=None, ge=0, le=100)
    quiz_pass_score: int | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class LectureCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    order_index: int = Field(ge=0, default=0)
    video_url: str | None = None
    duration_seconds: int = Field(ge=0, default=0)


class QuizOptionInput(BaseModel):
    option_text: str = Field(min_length=1, max_length=500)
    is_correct: bool = False


class QuizQuestionInput(BaseModel):
    question_text: str = Field(min_length=1)
    options: list[QuizOptionInput] = Field(min_length=2)


class QuizSet(BaseModel):
    questions: list[QuizQuestionInput] = Field(min_length=1)


class AdminOrderRow(BaseModel):
    id: int
    user_id: int
    username: str
    email: EmailStr | None = None
    course_title: str
    package_name: str
    amount: int
    payment_method: PaymentMethod
    status: OrderStatus
    created_at: datetime


class AdminOrdersResponse(BaseModel):
    items: list[AdminOrderRow]
    total: int
    page: int
    size: int


class AdminUsersResponse(BaseModel):
    items: list[AdminUser]
    total: int
    page: int
    size: int


class AdminSurveyRow(BaseModel):
    id: int
    order_id: int
    order_type: OrderType
    username: str
    course_title: str
    status: CounselingStatus
    submitted_at: datetime
    draft_sent_at: datetime | None
    completed_at: datetime | None
    ai_draft_url: str | None
    final_pdf_url: str | None


class AdminSurveyDetail(AdminSurveyRow):
    responses: dict[str, str]
    user_email: EmailStr | None = None


class AdminStats(BaseModel):
    total_users: int
    total_enrollments: int
    total_orders_paid: int
    total_revenue: int
    today_signups: int
    today_paid_orders: int
    today_revenue: int
    month_revenue: int
    recent_orders: list[AdminOrderRow]


class CourseEnrollmentCount(BaseModel):
    course_id: int
    course_title: str
    category: CourseCategory
    enrollment_count: int


class NoticePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1)
    file_url: str | None = None
    is_pinned: bool | None = None


class PostPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1)


# 단순 OK 응답
class OkResponse(BaseModel):
    ok: Literal[True] = True
