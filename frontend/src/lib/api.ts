import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const ACCESS_TOKEN_KEY = "kcpec_access_token";
const REFRESH_TOKEN_KEY = "kcpec_refresh_token";

export const tokenStorage = {
  getAccess(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefresh(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set(tokens: { access_token: string; refresh_token: string }) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
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

export function logout(): void {
  tokenStorage.clear();
}
