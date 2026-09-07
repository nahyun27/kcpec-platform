import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import type {
  CourseCategory,
  CourseDetail,
  CourseListItem,
  CourseReview,
  EnrollmentStatus,
  LectureProgressUpdate,
  QuizDetail,
  QuizResult,
  StreamUrlResponse,
} from "@/types/course";
import type {
  BundleCreateResponse,
  DocumentResponse,
  OrderResponse,
  PaymentMethod,
} from "@/types/order";
import type {
  CounselingOrderItem,
  CounselingPurchaseResponse,
  CounselingType,
  EnrollmentWithProgress,
  SurveyDetail,
  SurveyResponse,
  SurveyStatusResponse,
} from "@/types/counseling";
import type {
  AdminCourseCreate,
  AdminCoursePatch,
  AdminLectureCreate,
  AdminLectureFull,
  AdminLecturePatch,
  AdminOrdersResponse,
  AdminQuizQuestion,
  AdminQuizRead,
  AdminStats,
  SalesStats,
  VisitorStats,
  AdminSurveyDetail,
  AdminSurveyRow,
  AdminUserEnrollmentRow,
  AdminUsersResponse,
  CourseEnrollmentCount,
  HealthResponse,
  NoticePatch,
  PostPatch,
} from "@/types/admin";
import type {
  Faq,
  FaqCategory,
  FaqCreate,
  FaqPatch,
  NoticeCategory,
  NoticeCreate,
  NoticeDetail,
  PaginatedNotices,
  PaginatedPosts,
  PostCategory,
  PostCreate,
  PostDetail,
} from "@/types/community";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// 백엔드 origin (예: http://localhost:8000) — /static/... 같은 절대경로
// 정적 자원을 프런트(:3000) 가 아닌 백엔드(:8000) 에서 받기 위함.
function _backendOrigin(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "http://localhost:8000";
  }
}

/**
 * 백엔드가 내려준 정적 경로(`/static/...` 등) 를 브라우저에서 바로 열 수 있는
 * 절대 URL 로 변환한다. 이미 http(s) 절대 URL 이면 그대로 반환.
 */
export function absUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${_backendOrigin()}${path}`;
  return path;
}

// 실제 로그인 토큰은 httpOnly 쿠키(서버가 Set-Cookie 로 발급)로만 존재한다 —
// JS 에서는 절대 읽을 수 없어 XSS 로 토큰이 그대로 털리는 경로를 막는다.
// 아래 마커는 오직 "지금 로그인된 상태인가?" 를 화면에 표시하기 위한
// 참고용 플래그일 뿐, 이것만으로는 어떤 API 도 호출할 수 없다.
const AUTHED_MARKER_KEY = "kcpec_authed";

// 과거(localStorage 에 JWT 를 직접 저장하던 시절) 키 — 남아있으면 지운다.
const LEGACY_TOKEN_KEYS = ["kcpec_access_token", "kcpec_refresh_token", "access_token", "token", "refresh_token"];

function clearLegacyTokenKeys() {
  if (typeof window === "undefined") return;
  for (const k of LEGACY_TOKEN_KEYS) {
    window.localStorage.removeItem(k);
  }
}

export const tokenStorage = {
  getAccess(): string | null {
    if (typeof window === "undefined") return null;
    clearLegacyTokenKeys();
    return window.localStorage.getItem(AUTHED_MARKER_KEY);
  },
  set() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTHED_MARKER_KEY, "1");
    clearLegacyTokenKeys();
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(AUTHED_MARKER_KEY);
    clearLegacyTokenKeys();
  },
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  // 쿠키(로그인 세션)를 실어 보내고 Set-Cookie 를 받으려면 필수.
  withCredentials: true,
});

type RetryConfig = AxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  await axios.post(`${API_BASE_URL}/auth/refresh`, null, { withCredentials: true });
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const isUnauthorized = error.response?.status === 401;
    const isRefreshCall = original?.url?.includes("/auth/refresh");

    if (!isUnauthorized || !original || original._retry || isRefreshCall) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      // 갱신된 쿠키는 브라우저가 재요청에 자동으로 실어 보낸다.
      return api.request(original);
    } catch (refreshError) {
      tokenStorage.clear();
      return Promise.reject(refreshError);
    }
  },
);

export type SignupPayload = {
  username: string;
  password: string;
  email: string;
  birth_date: string; // YYYY-MM-DD
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type UserResponse = {
  id: number;
  username: string;
  email: string;
  birth_date: string | null;
  social_provider: string | null;
  is_active: boolean;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
};

export async function signup(payload: SignupPayload): Promise<UserResponse> {
  const { data } = await api.post<UserResponse>("/auth/signup", payload);
  tokenStorage.set();
  return data;
}

export async function login(payload: LoginPayload): Promise<UserResponse> {
  const { data } = await api.post<UserResponse>("/auth/login", payload);
  tokenStorage.set();
  return data;
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await api.get<UserResponse>("/auth/me");
  return data;
}

export async function verifyEmail(token: string): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>("/auth/verify-email", { token });
  return data;
}

export async function resendVerification(): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>("/auth/resend-verification");
  return data;
}

export async function forgotPassword(email: string): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ detail: string }> {
  const { data } = await api.post<{ detail: string }>("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return data;
}

export async function deleteMe(password?: string): Promise<void> {
  await api.delete("/auth/me", { data: { password: password ?? null } });
  tokenStorage.clear();
}

export type ProfileUpdatePayload = {
  email?: string;
  current_password?: string;
  new_password?: string;
};

export async function updateMe(payload: ProfileUpdatePayload): Promise<UserResponse> {
  const { data } = await api.patch<UserResponse>("/auth/me", payload);
  return data;
}

export function logout(): void {
  tokenStorage.clear();
  // 서버 쿠키도 지워야 한다 — fire-and-forget (실패해도 클라이언트는 이미 로그아웃 처리).
  api.post("/auth/logout").catch(() => {});
}

// ---------- courses ---------------------------------------------------------

export async function getCourses(category?: CourseCategory): Promise<CourseListItem[]> {
  const { data } = await api.get<CourseListItem[]>("/courses", {
    params: category ? { category } : undefined,
  });
  return data;
}

export async function getCourseDetail(courseId: number): Promise<CourseDetail> {
  const { data } = await api.get<CourseDetail>(`/courses/${courseId}`);
  return data;
}

export async function getCourseReviews(courseId: number): Promise<CourseReview[]> {
  const { data } = await api.get<CourseReview[]>(`/courses/${courseId}/reviews`);
  return data;
}

export async function getCourseProgress(courseId: number): Promise<EnrollmentStatus> {
  const { data } = await api.get<EnrollmentStatus>(`/courses/${courseId}/progress`);
  return data;
}

export async function updateLectureProgress(
  lectureId: number,
  payload: LectureProgressUpdate,
): Promise<EnrollmentStatus> {
  const { data } = await api.patch<EnrollmentStatus>(
    `/lectures/${lectureId}/progress`,
    payload,
  );
  return data;
}

export async function getStreamUrl(lectureId: number): Promise<StreamUrlResponse> {
  const { data } = await api.get<StreamUrlResponse>(`/lectures/${lectureId}/stream-url`);
  return data;
}

export async function getQuiz(courseId: number): Promise<QuizDetail> {
  const { data } = await api.get<QuizDetail>(`/courses/${courseId}/quiz`);
  return data;
}

export async function submitQuiz(
  courseId: number,
  answers: Record<number, number>,
): Promise<QuizResult> {
  const { data } = await api.post<QuizResult>(`/courses/${courseId}/quiz/submit`, {
    answers,
  });
  return data;
}

// ---------- orders / documents -----------------------------------

export async function createOrder(payload: {
  course_id: number;
  payment_method: PaymentMethod;
  amount: number;
}): Promise<OrderResponse> {
  const { data } = await api.post<OrderResponse>("/orders", payload);
  return data;
}

export async function confirmTossPayment(payload: {
  order_id: number;
  payment_key: string;
  amount: number;
}): Promise<OrderResponse> {
  const { data } = await api.post<OrderResponse>("/orders/toss/confirm", payload);
  return data;
}

export async function createOrderBundle(payload: {
  course_ids: number[];
  payment_method: PaymentMethod;
}): Promise<BundleCreateResponse> {
  const { data } = await api.post<BundleCreateResponse>("/orders/bundle", payload);
  return data;
}

export async function confirmBundleTossPayment(payload: {
  bundle_id: string;
  payment_key: string;
  amount: number;
}): Promise<OrderResponse[]> {
  const { data } = await api.post<OrderResponse[]>(
    "/orders/bundle/toss/confirm",
    payload,
  );
  return data;
}

export async function getMyOrders(): Promise<OrderResponse[]> {
  const { data } = await api.get<OrderResponse[]>("/orders/my");
  return data;
}

export async function cancelMyOrder(orderId: number): Promise<OrderResponse> {
  const { data } = await api.post<OrderResponse>(`/orders/${orderId}/cancel`);
  return data;
}

export async function issueDocument(
  orderId: number,
  payload: { recipient_name: string; recipient_birth: string },
): Promise<DocumentResponse> {
  const { data } = await api.post<DocumentResponse>(
    `/orders/${orderId}/issue`,
    payload,
  );
  return data;
}

export async function getOrderDocuments(orderId: number): Promise<DocumentResponse[]> {
  const { data } = await api.get<DocumentResponse[]>(`/orders/${orderId}/documents`);
  return data;
}

// ---------- counseling + my -------------------------------------------------

export async function getMyEnrollments(): Promise<EnrollmentWithProgress[]> {
  const { data } = await api.get<EnrollmentWithProgress[]>("/courses/my-enrollments");
  return data;
}

export async function submitSurvey(
  orderId: number,
  // personal 같은 nested object 허용 (구조화 인적사항)
  responses: Record<string, unknown>,
): Promise<SurveyResponse> {
  const { data } = await api.post<SurveyResponse>(`/orders/${orderId}/survey`, {
    responses,
  });
  return data;
}

export async function getSurveyStatus(
  orderId: number,
): Promise<SurveyStatusResponse | null> {
  // 백엔드는 설문 미제출 시 200 + null 반환 (404 아님).
  const { data } = await api.get<SurveyStatusResponse | null>(
    `/orders/${orderId}/survey`,
  );
  return data;
}

export async function getMySurvey(surveyId: number): Promise<SurveyDetail> {
  const { data } = await api.get<SurveyDetail>(`/counseling/surveys/${surveyId}`);
  return data;
}

export async function updateMySurvey(
  surveyId: number,
  responses: Record<string, unknown>,
): Promise<SurveyDetail> {
  const { data } = await api.put<SurveyDetail>(
    `/counseling/surveys/${surveyId}`,
    { responses },
  );
  return data;
}

// ---------- counseling 독립 구매 ----------------------------------------------

export async function purchaseCounseling(
  counseling_type: CounselingType,
): Promise<CounselingPurchaseResponse> {
  const { data } = await api.post<CounselingPurchaseResponse>(
    "/counseling/purchase",
    { counseling_type },
  );
  return data;
}

export async function getMyCounselingOrders(): Promise<CounselingOrderItem[]> {
  const { data } = await api.get<CounselingOrderItem[]>("/counseling/my-orders");
  return data;
}

// ---------- admin ----------------------------------------------------------

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>("/admin/stats");
  return data;
}

export async function getAdminSalesStats(): Promise<SalesStats> {
  const { data } = await api.get<SalesStats>("/admin/statistics/sales");
  return data;
}

export async function getAdminVisitorStats(): Promise<VisitorStats> {
  const { data } = await api.get<VisitorStats>("/admin/statistics/visitors");
  return data;
}

export async function getAdminUsers(
  page = 1,
  size = 20,
  courseId?: number,
): Promise<AdminUsersResponse> {
  const { data } = await api.get<AdminUsersResponse>("/admin/users", {
    params: { page, size, course_id: courseId },
  });
  return data;
}

export async function getAdminOrders(
  filter: { status?: string; page?: number; size?: number } = {},
): Promise<AdminOrdersResponse> {
  const { data } = await api.get<AdminOrdersResponse>("/admin/orders", { params: filter });
  return data;
}

export async function createCourse(payload: AdminCourseCreate): Promise<CourseListItem> {
  const { data } = await api.post<CourseListItem>("/admin/courses", payload);
  return data;
}

export async function addLecture(
  courseId: number,
  payload: AdminLectureCreate,
): Promise<{ id: number; title: string }> {
  const { data } = await api.post<{ id: number; title: string }>(
    `/admin/courses/${courseId}/lectures`,
    payload,
  );
  return data;
}

export async function setQuiz(
  courseId: number,
  questions: AdminQuizQuestion[],
): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>(
    `/admin/courses/${courseId}/quiz`,
    { questions },
  );
  return data;
}

export async function getAdminCourseQuiz(courseId: number): Promise<AdminQuizRead> {
  const { data } = await api.get<AdminQuizRead>(`/admin/courses/${courseId}/quiz`);
  return data;
}

export async function confirmBankOrder(orderId: number): Promise<OrderResponse> {
  // 주의: /admin/orders/bank/confirm/{id} 가 아니라 /orders/bank/confirm/{id} 다.
  // 예전엔 admin.py 에 이름이 같은 별도 엔드포인트가 하나 더 있었는데(지금은 삭제),
  // 그쪽은 _ensure_enrollment 호출이 빠져 있어서 관리자가 "입금 확인"을 눌러도
  // 결제 상태만 paid 로 바뀌고 실제 수강 등록은 되지 않는 버그가 있었다
  // (2026-09 발견·수정) — 반드시 이 경로(정상 구현)를 사용해야 함.
  const { data } = await api.post<OrderResponse>(
    `/orders/bank/confirm/${orderId}`,
  );
  return data;
}

export async function cancelAdminOrder(orderId: number): Promise<void> {
  await api.post(`/admin/orders/${orderId}/cancel`);
}

export async function refundAdminOrder(orderId: number): Promise<void> {
  await api.post(`/admin/orders/${orderId}/refund`);
}

export async function getAdminSurveys(): Promise<AdminSurveyRow[]> {
  const { data } = await api.get<AdminSurveyRow[]>("/admin/surveys");
  return data;
}

export async function getAdminSurveyDetail(id: number): Promise<AdminSurveyDetail> {
  const { data } = await api.get<AdminSurveyDetail>(`/admin/surveys/${id}`);
  return data;
}

export async function uploadFinalPdf(
  surveyId: number,
  file: File,
): Promise<AdminSurveyRow> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post<AdminSurveyRow>(
    `/admin/surveys/${surveyId}/upload-final`,
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

// 의견서 양식 자동 채우기 + DOCX/PDF 다운로드.
// 백엔드는 FileResponse 로 바이너리 반환 — blob 으로 받아 트리거.
export async function exportCounselingDoc(
  surveyId: number,
  draftText: string,
  format: "docx" | "pdf",
): Promise<Blob> {
  const { data } = await api.post<Blob>(
    `/admin/surveys/${surveyId}/export`,
    { draft_text: draftText, format },
    { responseType: "blob" },
  );
  return data;
}

// LLM(Gemini) 으로 초안 재생성 — 추가 지시사항 옵션.
export type RegenerateDraftResponse = {
  draft_text: string;
  draft_url: string;
  is_dummy: boolean;
};

export async function regenerateCounselingDraft(
  surveyId: number,
  extraInstructions: string = "",
): Promise<RegenerateDraftResponse> {
  const { data } = await api.post<RegenerateDraftResponse>(
    `/admin/surveys/${surveyId}/regenerate-draft`,
    { extra_instructions: extraInstructions },
  );
  return data;
}

export async function getCourseEnrollmentCounts(): Promise<CourseEnrollmentCount[]> {
  const { data } = await api.get<CourseEnrollmentCount[]>(
    "/admin/courses/enrollment-counts",
  );
  return data;
}

export async function getAdminUserEnrollments(
  userId: number,
): Promise<AdminUserEnrollmentRow[]> {
  const { data } = await api.get<AdminUserEnrollmentRow[]>(
    `/admin/users/${userId}/enrollments`,
  );
  return data;
}

// 수강기간 만료로 강의를 못 보게 된 사용자를 위한 연장(오늘부터 다시 30일).
export async function extendEnrollmentAccess(
  enrollmentId: number,
): Promise<AdminUserEnrollmentRow> {
  const { data } = await api.post<AdminUserEnrollmentRow>(
    `/admin/enrollments/${enrollmentId}/extend-access`,
  );
  return data;
}

// ---------- 어드민 강의/영상 관리 -----------------------------------------------

export async function getAdminCourses(): Promise<CourseListItem[]> {
  const { data } = await api.get<CourseListItem[]>("/admin/courses");
  return data;
}

export async function patchCourse(
  courseId: number,
  payload: AdminCoursePatch,
): Promise<CourseListItem> {
  const { data } = await api.patch<CourseListItem>(
    `/admin/courses/${courseId}`,
    payload,
  );
  return data;
}

export async function getAdminCourseLectures(
  courseId: number,
): Promise<AdminLectureFull[]> {
  const { data } = await api.get<AdminLectureFull[]>(
    `/admin/courses/${courseId}/lectures`,
  );
  return data;
}

export async function patchAdminLecture(
  lectureId: number,
  payload: AdminLecturePatch,
): Promise<AdminLectureFull> {
  const { data } = await api.patch<AdminLectureFull>(
    `/admin/lectures/${lectureId}`,
    payload,
  );
  return data;
}

export async function deleteAdminLecture(lectureId: number): Promise<void> {
  await api.delete(`/admin/lectures/${lectureId}`);
}

export async function getAdminOrderDocuments(orderId: number): Promise<DocumentResponse[]> {
  const { data } = await api.get<DocumentResponse[]>(
    `/admin/orders/${orderId}/documents`,
  );
  return data;
}

export async function patchAdminNotice(
  noticeId: number,
  payload: NoticePatch,
): Promise<NoticeDetail> {
  const { data } = await api.patch<NoticeDetail>(
    `/admin/notices/${noticeId}`,
    payload,
  );
  return data;
}

export async function deleteAdminNotice(noticeId: number): Promise<void> {
  await api.delete(`/admin/notices/${noticeId}`);
}

export async function patchAdminPost(
  postId: number,
  payload: PostPatch,
): Promise<PostDetail> {
  const { data } = await api.patch<PostDetail>(`/admin/posts/${postId}`, payload);
  return data;
}

export async function deleteAdminPost(postId: number): Promise<void> {
  await api.delete(`/admin/posts/${postId}`);
}

export async function patchAdminPostReply(
  postId: number,
  reply: string,
): Promise<PostDetail> {
  const { data } = await api.patch<PostDetail>(
    `/admin/posts/${postId}/reply`,
    { reply },
  );
  return data;
}

// ---------- community ------------------------------------------------------

export async function getNotices(
  category?: NoticeCategory,
  page = 1,
  size = 20,
): Promise<PaginatedNotices> {
  const { data } = await api.get<PaginatedNotices>("/notices", {
    params: { category, page, size },
  });
  return data;
}

export async function getNotice(id: number): Promise<NoticeDetail> {
  const { data } = await api.get<NoticeDetail>(`/notices/${id}`);
  return data;
}

export async function createNotice(payload: NoticeCreate): Promise<NoticeDetail> {
  const { data } = await api.post<NoticeDetail>("/notices", payload);
  return data;
}

export async function getPosts(
  category?: PostCategory,
  page = 1,
  size = 20,
): Promise<PaginatedPosts> {
  const { data } = await api.get<PaginatedPosts>("/posts", {
    params: { category, page, size },
  });
  return data;
}

// ---------- faq --------------------------------------------------------------

export async function getFaqs(category?: FaqCategory): Promise<Faq[]> {
  const { data } = await api.get<Faq[]>("/faq", { params: { category } });
  return data;
}

export async function getAdminFaqs(): Promise<Faq[]> {
  const { data } = await api.get<Faq[]>("/admin/faq");
  return data;
}

export async function getSystemHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>("/admin/health");
  return data;
}

export async function createFaq(payload: FaqCreate): Promise<Faq> {
  const { data } = await api.post<Faq>("/admin/faq", payload);
  return data;
}

export async function patchFaq(faqId: number, payload: FaqPatch): Promise<Faq> {
  const { data } = await api.patch<Faq>(`/admin/faq/${faqId}`, payload);
  return data;
}

export async function deleteFaq(faqId: number): Promise<void> {
  await api.delete(`/admin/faq/${faqId}`);
}

export async function getPost(id: number): Promise<PostDetail> {
  const { data } = await api.get<PostDetail>(`/posts/${id}`);
  return data;
}

export async function createPost(payload: PostCreate): Promise<PostDetail> {
  const { data } = await api.post<PostDetail>("/posts", payload);
  return data;
}
