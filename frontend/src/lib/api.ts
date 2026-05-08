import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  CourseCategory,
  CourseDetail,
  CourseListItem,
  EnrollmentStatus,
  LectureProgressUpdate,
  QuizDetail,
  QuizResult,
  StreamUrlResponse,
} from "@/types/course";
import type {
  DocumentResponse,
  OrderResponse,
  PackageWithDocuments,
  PaymentMethod,
} from "@/types/order";
import type {
  CounselingOrderItem,
  CounselingPurchaseResponse,
  CounselingType,
  EnrollmentWithProgress,
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
  AdminSurveyDetail,
  AdminSurveyRow,
  AdminUserEnrollmentRow,
  AdminUsersResponse,
  CourseEnrollmentCount,
  NoticePatch,
  PostPatch,
} from "@/types/admin";
import type {
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

const ACCESS_TOKEN_KEY = "kcpec_access_token";
const REFRESH_TOKEN_KEY = "kcpec_refresh_token";

// 과거 dev 빌드에서 사용했던 키들 — 발견되면 캐노니컬 키로 옮긴 뒤 제거한다.
// (이 마이그레이션이 없으면, 옛 키로 저장된 토큰이 새 키로 읽히지 않아
//  로그인 직후에도 AdminShell 등이 "토큰 없음"으로 판정해 잘못 리다이렉트한다.)
const LEGACY_ACCESS_KEYS = ["access_token", "token"];
const LEGACY_REFRESH_KEYS = ["refresh_token"];

function migrateLegacy(canonical: string, legacyKeys: string[]): string | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(canonical);
  if (current) return current;
  for (const k of legacyKeys) {
    const v = window.localStorage.getItem(k);
    if (v) {
      window.localStorage.setItem(canonical, v);
      window.localStorage.removeItem(k);
      return v;
    }
  }
  return null;
}

export const tokenStorage = {
  getAccess(): string | null {
    return migrateLegacy(ACCESS_TOKEN_KEY, LEGACY_ACCESS_KEYS);
  },
  getRefresh(): string | null {
    return migrateLegacy(REFRESH_TOKEN_KEY, LEGACY_REFRESH_KEYS);
  },
  set(tokens: { access_token: string; refresh_token: string }) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    // 캐노니컬 키로 새로 발급된 직후엔 레거시 키도 깨끗이 정리.
    if (typeof window === "undefined") return;
    for (const k of [...LEGACY_ACCESS_KEYS, ...LEGACY_REFRESH_KEYS]) {
      window.localStorage.removeItem(k);
    }
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    for (const k of [...LEGACY_ACCESS_KEYS, ...LEGACY_REFRESH_KEYS]) {
      window.localStorage.removeItem(k);
    }
  },
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

type RetryConfig = AxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) throw new Error("No refresh token");

  const { data } = await axios.post<TokenResponse>(
    `${API_BASE_URL}/auth/refresh`,
    { refresh_token: refresh },
    { headers: { "Content-Type": "application/json" } },
  );
  tokenStorage.set(data);
  return data.access_token;
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
      const newToken = await refreshPromise;
      original.headers = original.headers ?? {};
      (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
      return api.request(original);
    } catch (refreshError) {
      tokenStorage.clear();
      return Promise.reject(refreshError);
    }
  },
);

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

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
  created_at: string;
};

export async function signup(payload: SignupPayload): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>("/auth/signup", payload);
  tokenStorage.set(data);
  return data;
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>("/auth/login", payload);
  tokenStorage.set(data);
  return data;
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await api.get<UserResponse>("/auth/me");
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

export async function enrollCourse(courseId: number): Promise<EnrollmentStatus> {
  const { data } = await api.post<EnrollmentStatus>(`/courses/${courseId}/enroll`);
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

// ---------- packages / orders / documents -----------------------------------

export async function getPackages(): Promise<PackageWithDocuments[]> {
  const { data } = await api.get<PackageWithDocuments[]>("/packages");
  return data;
}

export async function createOrder(payload: {
  course_id: number;
  package_id: number;
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
  is_simulated?: boolean;
}): Promise<OrderResponse> {
  const { data } = await api.post<OrderResponse>("/orders/toss/confirm", payload);
  return data;
}

export async function getMyOrders(): Promise<OrderResponse[]> {
  const { data } = await api.get<OrderResponse[]>("/orders/my");
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
  responses: Record<string, string>,
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
  const { data } = await api.get<SalesStats>("/admin/stats/sales");
  return data;
}

export async function getAdminUsers(page = 1, size = 20): Promise<AdminUsersResponse> {
  const { data } = await api.get<AdminUsersResponse>("/admin/users", {
    params: { page, size },
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
  const { data } = await api.post<OrderResponse>(
    `/admin/orders/bank/confirm/${orderId}`,
  );
  return data;
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

export async function getPost(id: number): Promise<PostDetail> {
  const { data } = await api.get<PostDetail>(`/posts/${id}`);
  return data;
}

export async function createPost(payload: PostCreate): Promise<PostDetail> {
  const { data } = await api.post<PostDetail>("/posts", payload);
  return data;
}
