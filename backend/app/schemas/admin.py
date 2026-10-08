from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.counseling import CounselingStatus
from app.models.course import CourseCategory
from app.models.document import IssuedDocumentStatus, IssuedDocumentType
from app.models.order import OrderStatus, OrderType, PaymentMethod


class AdminUser(BaseModel):
    id: int
    username: str
    # 회원탈퇴 시 email 이 익명화(placeholder) 값으로 바뀌는데, 그 값이
    # 실제 이메일 형식을 벗어나 EmailStr 검증에 걸려 관리자 목록 API 전체가
    # 500 으로 죽는 문제가 있었다(2026-09, 탈퇴 회원 발생 후 발견) — 조회용
    # 표시 필드라 굳이 형식을 검증할 필요가 없어 일반 문자열로 완화.
    email: str
    name: str | None = None
    phone: str | None = None
    birth_date: date | None
    is_active: bool
    is_admin: bool
    is_legacy_member: bool = False
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
    # 할인 전 정가 — 입력 시 price 보다 커야 함 (create_course 에서 검증).
    original_price: int | None = Field(default=None, ge=0)
    thumbnail_url: str | None = None
    min_progress_pct: int = Field(ge=0, le=100, default=90)
    quiz_pass_score: int = Field(ge=0, le=100, default=70)


class CoursePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: CourseCategory | None = None
    price: int | None = Field(default=None, ge=0)
    original_price: int | None = Field(default=None, ge=0)
    thumbnail_url: str | None = None
    min_progress_pct: int | None = Field(default=None, ge=0, le=100)
    quiz_pass_score: int | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class LectureCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    order_index: int = Field(ge=0, default=0)
    video_url: str | None = None
    duration_seconds: int = Field(ge=0, default=0)


class LecturePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    order_index: int | None = Field(default=None, ge=0)
    video_url: str | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class LectureFull(BaseModel):
    id: int
    title: str
    order_index: int
    video_url: str | None
    duration_seconds: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class QuizOptionInput(BaseModel):
    option_text: str = Field(min_length=1, max_length=500)
    is_correct: bool = False


class QuizQuestionInput(BaseModel):
    question_text: str = Field(min_length=1)
    options: list[QuizOptionInput] = Field(min_length=2)


class QuizSet(BaseModel):
    questions: list[QuizQuestionInput] = Field(min_length=1)


class QuizOptionRead(BaseModel):
    id: int
    option_text: str
    is_correct: bool

    model_config = ConfigDict(from_attributes=True)


class QuizQuestionRead(BaseModel):
    id: int
    question_text: str
    order_index: int
    options: list[QuizOptionRead]

    model_config = ConfigDict(from_attributes=True)


class QuizRead(BaseModel):
    exists: bool
    questions: list[QuizQuestionRead] = []


class AdminOrderRow(BaseModel):
    id: int
    user_id: int
    username: str
    name: str | None = None
    email: str | None = None
    course_title: str
    amount: int
    # 강의 정가(Course.price) — 묶음결제 할인이 이 항목에 몰려 amount 가
    # 정가보다 낮게(0원까지) 찍힐 수 있어, 관리자 화면에서 "정가 대비 할인"을
    # 따로 보여주기 위함(2026-09, "반성문이 0원으로 결제됐다" 문의로 발견 —
    # 실제로는 결제/가격 모두 정상이고 10,000원 묶음할인이 이 항목에 전액
    # 반영돼 amount 만 0원으로 보인 것). None 이면(강의 삭제 등) 비교 생략.
    course_price: int | None = None
    payment_method: PaymentMethod
    status: OrderStatus
    created_at: datetime
    bundle_id: str | None = None
    # 결제 시 선택한 변호사 리퍼럴 — "{법무법인명} {변호사명}" 합쳐서, 없으면 None.
    lawyer_partner_name: str | None = None


class AdminOrderBundleSibling(BaseModel):
    """묶음결제 환불 확인창용 — 환불하려는 주문과 같은 bundle_id 를 공유하는
    나머지 주문들. 토스 결제취소가 결제 1건(=묶음 전체) 단위라, 이 중
    하나만 골라 환불해도 실제로는 여기 나열된 항목 전부가 함께 REFUNDED
    되고 발급된 서류가 있으면 무효화된다(2026-09, 관리자가 "주문 #123을
    환불 처리하시겠습니까?"라는 단수형 문구만 보고 이 사실을 모른 채
    이미 발급·발송된 다른 과정의 수료증까지 지워버릴 수 있었던 문제로 추가)."""

    order_id: int
    course_title: str
    amount: int
    status: OrderStatus
    has_issued_document: bool


class AdminOrdersResponse(BaseModel):
    items: list[AdminOrderRow]
    total: int
    page: int
    size: int


class AdminIssuedDocumentRow(BaseModel):
    id: int
    order_id: int
    user_id: int
    username: str
    name: str | None = None
    email: str | None = None
    recipient_name: str
    document_type: IssuedDocumentType
    course_title: str
    issue_number: str
    status: IssuedDocumentStatus
    issued_at: datetime | None
    pdf_url: str | None
    pledge_pdf_url: str | None


class AdminIssuedDocumentsResponse(BaseModel):
    items: list[AdminIssuedDocumentRow]
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
    # 상담 상품만 따로 결제했는지, 맞춤강의찾기 등에서 다른 상품과 함께
    # 묶음결제했는지 — order_type(COUNSELING 고정)이 아니라 Order.bundle_id
    # 유무로 판단해야 한다(2026-10, "유형이 전부 독립구매로만 뜬다"는 지적으로
    # 발견 — 기존엔 order_type 기준이라 상담 설문은 항상 COUNSELING이라
    # 사실상 늘 "독립 구매"로만 표시되고 있었다).
    bundle_id: str | None
    username: str
    course_title: str
    status: CounselingStatus
    submitted_at: datetime
    draft_sent_at: datetime | None
    completed_at: datetime | None
    ai_draft_url: str | None
    final_pdf_url: str | None


class AdminSurveyDetail(AdminSurveyRow):
    # personal 같은 nested dict 도 허용.
    responses: dict[str, Any]
    user_email: str | None = None
    # 전화 심화상담(15분 x 3회) 전용 — 서면/대면 상담은 항상 None.
    call_note_1: str | None = None
    call_note_2: str | None = None
    call_note_3: str | None = None
    # 전화 심화상담 의견서 양식의 "상담회차" 표에 찍히는 실제 통화 날짜.
    call_date_1: date | None = None
    call_date_2: date | None = None
    call_date_3: date | None = None


class AdminSurveyCallNotesUpdate(BaseModel):
    call_note_1: str | None = None
    call_note_2: str | None = None
    call_note_3: str | None = None
    call_date_1: date | None = None
    call_date_2: date | None = None
    call_date_3: date | None = None


class SalesStatsDaily(BaseModel):
    date: str  # ISO YYYY-MM-DD
    revenue: int  # 강의+심리상담 합계(전체)
    orders: int
    counseling_revenue: int  # revenue 중 심리상담 몫(부분집합)


class SalesStatsMonthly(BaseModel):
    month: str  # ISO YYYY-MM (한국 시간 기준)
    revenue: int
    orders: int


class SalesStatsHourly(BaseModel):
    hour: int  # 0~23 (한국 시간)
    orders: int
    revenue: int


class SalesStatsByCourse(BaseModel):
    course_title: str
    category: CourseCategory
    count: int
    revenue: int


class SalesStatsByPayment(BaseModel):
    method: PaymentMethod
    count: int
    revenue: int


class SalesStats(BaseModel):
    this_month_revenue: int
    this_month_orders: int
    last_month_revenue: int
    avg_order_amount: int
    daily_revenue: list[SalesStatsDaily]
    # 최근 12개월(이번달 포함) 월별 매출 — daily_revenue 의 days 선택기와
    # 무관하게 항상 고정 12개월. "연간 매출" 카드/차트용.
    monthly_revenue: list[SalesStatsMonthly]
    by_course: list[SalesStatsByCourse]
    by_payment: list[SalesStatsByPayment]
    # by_course 는 강의/심리상담 구분 없이 다 섞여 있어서, 심리상담 누적
    # 매출만 따로 보고 싶을 때 이 값(과 by_course 합계에서 뺀 나머지)으로
    # 계산한다 — by_course 와 동일하게 전체 기간 paid 누적 기준.
    counseling_revenue: int
    # 결제 발생 시간대(한국 시간 0~23시) — daily_revenue 와 같은 기간(days) 기준.
    hourly: list[SalesStatsHourly]


class VisitorStatsDaily(BaseModel):
    date: str  # ISO YYYY-MM-DD
    new_users: int


class VisitorStats(BaseModel):
    new_users_this_month: int
    new_users_last_month: int
    total_enrollments: int
    # 결제 완료 / 신규 가입 (이번달 기준, %)
    conversion_rate: float
    # 활성 사용자 1인당 평균 수강 신청 수
    avg_courses_per_user: float
    daily_signups: list[VisitorStatsDaily]


class AdminUserBrief(BaseModel):
    id: int
    name: str
    # 회원탈퇴 시 email 이 익명화(placeholder) 값으로 바뀌는데, 그 값이
    # 실제 이메일 형식을 벗어나 EmailStr 검증에 걸려 관리자 목록 API 전체가
    # 500 으로 죽는 문제가 있었다(2026-09, 탈퇴 회원 발생 후 발견) — 조회용
    # 표시 필드라 굳이 형식을 검증할 필요가 없어 일반 문자열로 완화.
    email: str
    created_at: datetime


class AdminTopCourse(BaseModel):
    course_title: str
    revenue: int
    percentage: float  # 0~100, 전체 매출 대비


class AdminActivity(BaseModel):
    type: Literal["order_paid", "course_completed", "qna_posted"]
    message: str
    created_at: datetime


class AdminTodoCounts(BaseModel):
    """관리자가 지금 처리해야 할 항목 수 — 대시보드 상단 "할 일" 배너용.

    전부 0이면 배너 자체를 안 띄운다(프론트에서 판단).
    """

    pending_bank_transfer: int
    counseling_draft_review: int
    unanswered_qna: int
    detention_to_process: int = 0
    legal_letter_review: int = 0


class AdminStats(BaseModel):
    total_users: int
    total_enrollments: int
    total_orders_paid: int
    total_revenue: int
    today_signups: int
    today_paid_orders: int
    today_revenue: int
    yesterday_new_users: int = 0
    yesterday_orders: int = 0
    yesterday_revenue: int = 0
    month_revenue: int
    recent_orders: list[AdminOrderRow]
    top_courses: list[AdminTopCourse] = []
    recent_users: list[AdminUserBrief] = []
    recent_activities: list[AdminActivity] = []
    todo: AdminTodoCounts


class CourseEnrollmentCount(BaseModel):
    course_id: int
    course_title: str
    category: CourseCategory
    enrollment_count: int


class LectureProgressDetail(BaseModel):
    lecture_id: int
    lecture_title: str
    order_index: int
    watched_seconds: int
    duration_seconds: int
    progress_pct: int
    is_completed: bool


class AdminIssuedDocumentSummary(BaseModel):
    id: int
    document_type: IssuedDocumentType
    issue_number: str
    status: IssuedDocumentStatus
    issued_at: datetime | None
    downloaded_at: datetime | None
    pdf_url: str | None
    pledge_pdf_url: str | None


class AdminUserEnrollmentRow(BaseModel):
    enrollment_id: int
    course_id: int
    course_title: str
    category: CourseCategory
    overall_progress_pct: int
    is_completed: bool
    quiz_passed: bool
    has_quiz: bool
    # 심리상담(퀴즈 없는 과정)의 설문 제출 여부 — 미제출이면 None.
    survey_status: CounselingStatus | None = None
    # None 이면 수강기간 제한 없음(레거시 enrollment).
    expires_at: datetime | None = None
    lectures: list[LectureProgressDetail] = []
    # 발급된 수료증/의견서 — 아직 발급 안 됐으면 None.
    document: AdminIssuedDocumentSummary | None = None


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


class HealthItem(BaseModel):
    name: str
    ok: bool
    detail: str | None = None


class HealthResponse(BaseModel):
    all_ok: bool
    checked_at: datetime
    items: list[HealthItem]
