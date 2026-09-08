"use client";

import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  absUrl,
  exportCounselingDoc,
  getAdminSurveyDetail,
  getAdminSurveys,
  regenerateCounselingDraft,
  uploadFinalPdf,
} from "@/lib/api";
import type { AdminSurveyDetail, AdminSurveyRow } from "@/types/admin";
import type { CounselingStatus } from "@/types/counseling";
import { useDialog } from "@/components/ui/DialogProvider";

// 초안 부재 시 textarea 에 보일 기본 템플릿. document_generator 의
// [상담배경]/[상담내용] 섹션 분리 패턴을 그대로 따른다.
const DEFAULT_DRAFT_TEMPLATE = `[상담배경]
1.

[상담내용]
1. `;

export default function AdminSurveysPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<AdminSurveyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  // surveyId 와 draftPath(없으면 null) 를 함께 보관 — modal 이 export 호출 시 surveyId 필요.
  const [draftTarget, setDraftTarget] = useState<{
    surveyId: number;
    path: string | null;
  } | null>(null);

  async function load() {
    setError(null);
    try {
      setRows(await getAdminSurveys());
    } catch {
      setError("의견서 목록을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(surveyId: number, file: File) {
    setUploadingId(surveyId);
    try {
      const updated = await uploadFinalPdf(surveyId, file);
      setRows((prev) => prev.map((r) => (r.id === surveyId ? updated : r)));
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "최종본 업로드에 실패했습니다.");
    } finally {
      setUploadingId(null);
    }
  }

  if (error) return <p className="py-20 text-center text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-sans text-2xl font-bold text-[var(--color-primary)]">
          의견서 관리
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          행을 클릭하여 응답 상세를 확인하고, Claude 초안 검토 후 최종 PDF 를
          업로드하면 사용자에게 자동 발송됩니다.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          제출된 설문이 없습니다.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">설문</th>
                <th className="px-4 py-3">유형</th>
                <th className="px-4 py-3">사용자</th>
                <th className="px-4 py-3">강의/프로그램</th>
                <th className="px-4 py-3">제출일</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="cursor-pointer transition-colors hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3 text-xs text-slate-500">#{r.id}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.order_type === "counseling"
                          ? "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10"
                          : "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10"
                      }`}
                    >
                      {r.order_type === "counseling" ? "독립 구매" : "강의 결제"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.username}</td>
                  <td className="px-4 py-3 text-slate-700">{r.course_title}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(r.submitted_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <SurveyStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(r.id)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                      >
                        응답 보기
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftTarget({
                            surveyId: r.id,
                            path: r.ai_draft_url ?? null,
                          })
                        }
                        title={
                          r.ai_draft_url
                            ? "Claude 초안 보기"
                            : "기본 템플릿으로 직접 작성"
                        }
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                      >
                        초안 보기
                      </button>
                      {r.status === "completed" && r.final_pdf_url ? (
                        <a
                          href={absUrl(r.final_pdf_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700"
                        >
                          최종본 PDF
                        </a>
                      ) : (
                        <>
                          <input
                            ref={(el) => {
                              fileInputs.current[r.id] = el;
                            }}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleUpload(r.id, f);
                              e.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputs.current[r.id]?.click()}
                            disabled={uploadingId === r.id}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                          >
                            {uploadingId === r.id ? "업로드 중..." : "최종본 업로드"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId != null ? (
        <SurveyDetailModal
          surveyId={openId}
          onClose={() => setOpenId(null)}
          onUpload={(file) => handleUpload(openId, file)}
          onOpenDraft={(surveyId, path) =>
            setDraftTarget({ surveyId, path })
          }
        />
      ) : null}

      {draftTarget ? (
        <DraftViewerModal
          surveyId={draftTarget.surveyId}
          path={draftTarget.path}
          onClose={() => {
            setDraftTarget(null);
            // 초안 재생성으로 상태(SUBMITTED→DRAFT_GENERATED)가 바뀌었을 수 있어
            // 닫을 때 목록을 새로 불러온다 — 안 그러면 새로고침 전까지 행의
            // 상태 배지가 재생성 전 상태로 남아있었다.
            load();
          }}
        />
      ) : null}
    </div>
  );
}

// ---------- modal --------------------------------------------------------

const QUESTION_LABELS: Record<string, string> = {
  // 신형 키
  q2: "이 사건의 내용",
  q3: "이 사건에서 가장 후회되는 점",
  q4: "이 사건으로 인해 가장 걱정되는 점",
  q5: "추후 재범하지 않기 위해 스스로 노력해야 하는 점",
  q6: "더 하고 싶은 말",
  // 구버전 한글 키 호환
  인적사항: "인적사항",
  사건내용: "이 사건의 내용",
  후회되는점: "이 사건에서 가장 후회되는 점",
  걱정되는점: "이 사건으로 인해 가장 걱정되는 점",
  재범방지노력: "추후 재범하지 않기 위해 스스로 노력해야 하는 점",
  하고싶은말: "더 하고 싶은 말 (선택사항)",
};

const ORDERED_KEYS = [
  "personal",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  // 구버전 호환 — 신키 없으면 사용
  "인적사항",
  "사건내용",
  "후회되는점",
  "걱정되는점",
  "재범방지노력",
  "하고싶은말",
];

const PERSONAL_LABELS: Record<string, string> = {
  name: "성명",
  gender: "성별",
  birthdate: "생년월일",
  age: "나이",
  phone: "연락처",
  job: "직업",
  education: "학력",
  family: "가족관계",
  criminal_record: "전과 유무",
  criminal_detail: "전과 내용",
  health: "건강상태",
  military: "병역",
};

const PERSONAL_KEY_ORDER = [
  "name",
  "gender",
  "birthdate",
  "age",
  "phone",
  "job",
  "education",
  "family",
  "criminal_record",
  "criminal_detail",
  "health",
  "military",
];

function PersonalAdminSummary({ data }: { data: Record<string, unknown> }) {
  const known = PERSONAL_KEY_ORDER.filter(
    (k) => data[k] != null && data[k] !== "",
  ).map((k) => [k, data[k]] as const);
  const extra = Object.entries(data).filter(
    ([k, v]) =>
      !PERSONAL_KEY_ORDER.includes(k) && v != null && v !== "",
  );
  const all = [...known, ...extra];
  if (all.length === 0) {
    return <span className="text-zinc-400">(인적사항 미입력)</span>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {all.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-sm">
          <dt className="w-20 shrink-0 text-slate-500">
            {PERSONAL_LABELS[k] ?? k}
          </dt>
          <dd className="font-medium text-slate-800">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function SurveyDetailModal({
  surveyId,
  onClose,
  onUpload,
  onOpenDraft,
}: {
  surveyId: number;
  onClose: () => void;
  onUpload: (file: File) => Promise<void> | void;
  onOpenDraft: (surveyId: number, path: string | null) => void;
}) {
  const [detail, setDetail] = useState<AdminSurveyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getAdminSurveyDetail(surveyId)
      .then(setDetail)
      .catch(() => setError("상세 정보를 불러오지 못했습니다."));
  }, [surveyId]);

  function renderResponses(responses: Record<string, unknown>) {
    // 알려진 키부터 정해진 순서로, 그 외 키는 뒤에 이어서.
    const known = ORDERED_KEYS.filter((k) => k in responses);
    const unknown = Object.keys(responses).filter((k) => !ORDERED_KEYS.includes(k));
    const all = [...known, ...unknown];
    if (all.length === 0) return <p className="text-sm text-zinc-500">응답이 없습니다.</p>;
    return (
      <dl className="space-y-5">
        {all.map((k) => {
          const value = responses[k];
          const label = k === "personal" ? "인적사항" : QUESTION_LABELS[k] ?? k;
          return (
            <div key={k}>
              <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
                {label}
              </dt>
              <dd className="mt-1.5 rounded-lg border border-zinc-200 bg-slate-50/50 px-4 py-3 text-sm leading-relaxed text-slate-800">
                {k === "personal" && value && typeof value === "object" ? (
                  <PersonalAdminSummary data={value as Record<string, unknown>} />
                ) : (
                  <span className="whitespace-pre-wrap">
                    {String(value || "") || (
                      <span className="text-zinc-400">(빈 응답)</span>
                    )}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
              심리상담 설문 응답 #{surveyId}
            </h2>
            {detail ? (
              <p className="mt-1 text-xs text-zinc-500">
                {detail.username}
                {detail.user_email ? ` · ${detail.user_email}` : ""} ·{" "}
                {detail.course_title} ·{" "}
                {new Date(detail.submitted_at).toLocaleString("ko-KR")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !detail ? (
            <p className="text-sm text-zinc-500">불러오는 중...</p>
          ) : (
            renderResponses(detail.responses)
          )}
        </div>

        {detail ? (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-slate-50/50 px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenDraft(detail.id, detail.ai_draft_url ?? null)}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:border-[var(--color-primary)]"
              >
                {detail.ai_draft_url ? "Claude 초안 보기" : "직접 작성"}
              </button>
              {detail.status === "completed" && detail.final_pdf_url ? (
                <a
                  href={absUrl(detail.final_pdf_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                >
                  최종본 PDF
                </a>
              ) : null}
            </div>
            {detail.status !== "completed" ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUpload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                >
                  최종본 업로드
                </button>
              </>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

// ---------- draft viewer modal -------------------------------------------

function DraftViewerModal({
  surveyId,
  path,
  onClose,
}: {
  surveyId: number;
  path: string | null;
  onClose: () => void;
}) {
  const dialog = useDialog();
  const [text, setText] = useState<string>(path ? "" : DEFAULT_DRAFT_TEMPLATE);
  const [loading, setLoading] = useState<boolean>(!!path);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<"docx" | "pdf" | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [extraInstructions, setExtraInstructions] = useState("");

  useEffect(() => {
    if (!path) {
      // 초안 없음 — 기본 템플릿 prefill 상태 그대로
      setLoading(false);
      return;
    }
    let cancelled = false;
    const url = absUrl(path);
    setLoading(true);
    setError(null);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((body) => {
        if (!cancelled) setText(body);
      })
      .catch(() => {
        if (!cancelled) setError("초안 파일을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 차단 환경 — 사용자가 직접 선택/복사 */
    }
  }

  async function handleDownload(format: "docx" | "pdf") {
    if (!text.trim()) {
      await dialog.alert("초안 내용이 비어있습니다.");
      return;
    }
    setDownloading(format);
    try {
      const blob = await exportCounselingDoc(surveyId, text, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `심리상담_의견서_${surveyId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? `${format.toUpperCase()} 다운로드에 실패했습니다.`);
    } finally {
      setDownloading(null);
    }
  }

  // 현재 textarea 내용으로 PDF 만든 뒤 새 탭에서 인라인 표시 (다운로드 X).
  async function handlePreview() {
    if (!text.trim()) {
      await dialog.alert("초안 내용이 비어있습니다.");
      return;
    }
    setPreviewing(true);
    try {
      const blob = await exportCounselingDoc(surveyId, text, "pdf");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // blob URL 은 새 탭이 닫혀도 자동 정리되므로 즉시 revoke 하지 않음.
      // 안전장치로 1분 후 정리.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "미리보기 생성에 실패했습니다.");
    } finally {
      setPreviewing(false);
    }
  }

  // Gemini 에 추가 지시사항을 함께 보내 초안 재생성.
  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await regenerateCounselingDraft(surveyId, extraInstructions);
      setText(res.draft_text);
      setExtraInstructions("");
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : null;
      await dialog.alert(detail ?? "초안 재생성에 실패했습니다.");
    } finally {
      setRegenerating(false);
    }
  }

  const busy = downloading != null || previewing || regenerating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="font-sans text-lg font-bold text-[var(--color-primary)]">
              심리상담 의견서 초안
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              아래 내용을 검토하고 수정 후 다운로드하세요.
              {path ? null : " (Claude 초안이 없어 기본 템플릿이 표시됩니다.)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            닫기
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-zinc-500">불러오는 중...</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-red-600">{error}</p>
          ) : (
            <>
              {/* AI 자동 생성이 실패해(키 미설정/무효/API 오류 등) 더미 텍스트가
                  나온 경우 — 더미임을 알리는 문구가 본문 중간에 섞여 있어서
                  훑어보다 놓치기 쉬우므로 눈에 띄는 배너로 한 번 더 알림.
                  backend/app/core/gemini_client.py 의 DUMMY_DRAFT_MARKER 와
                  반드시 동일한 문자열을 사용할 것. */}
              {text.includes("[시스템 점검용 더미 텍스트]") ? (
                <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  ⚠️ 이 초안은 AI 자동 생성에 실패하여 대신 표시된 더미
                  텍스트입니다. 실제 상담 내용이 아니니 그대로 발송/다운로드하지
                  마세요.
                </div>
              ) : null}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                disabled={regenerating}
                className="min-h-[50vh] w-full flex-1 resize-none rounded-md border border-zinc-200 bg-slate-50/50 p-4 font-mono text-[13px] leading-relaxed text-slate-800 focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-60"
              />

              {/* LLM 재생성 영역 */}
              <div className="rounded-md border border-zinc-200 bg-slate-50/40 p-3">
                <label className="block text-xs font-bold text-slate-700">
                  추가 지시 (선택)
                </label>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Gemini 에 전달할 추가 요청사항. 비워두면 기본 프롬프트로 재생성합니다.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    value={extraInstructions}
                    onChange={(e) => setExtraInstructions(e.target.value)}
                    rows={2}
                    placeholder="예) 재범 방지 계획을 더 구체적으로, 가족 지지체계 강조"
                    disabled={regenerating}
                    className="flex-1 resize-y rounded border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={loading || !!error || busy}
                    className="inline-flex min-w-[140px] items-center justify-center self-stretch rounded-md border border-[var(--color-primary)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-primary)] shadow-sm transition-colors hover:bg-[var(--color-primary)]/5 disabled:opacity-50"
                  >
                    {regenerating ? "재생성 중..." : "LLM 다시 돌리기"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-slate-50/50 px-6 py-3">
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading || !!error || busy}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {copied ? "복사됨" : "복사하기"}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loading || !!error || busy}
              className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {previewing ? "생성 중..." : "미리 보기"}
            </button>
            <button
              type="button"
              onClick={() => handleDownload("docx")}
              disabled={loading || !!error || busy}
              className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {downloading === "docx" ? "생성 중..." : "DOCX 다운로드"}
            </button>
            <button
              type="button"
              onClick={() => handleDownload("pdf")}
              disabled={loading || !!error || busy}
              className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {downloading === "pdf" ? "변환 중..." : "PDF 다운로드"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SurveyStatusBadge({ status }: { status: CounselingStatus }) {
  const map: Record<CounselingStatus, { label: string; cls: string }> = {
    submitted: { label: "검토 대기", cls: "bg-slate-100 text-slate-700 ring-slate-500/10" },
    draft_generated: { label: "초안 생성", cls: "bg-blue-50 text-blue-700 ring-blue-600/10" },
    sent_to_staff: { label: "검토 중", cls: "bg-amber-50 text-amber-700 ring-amber-600/10" },
    completed: { label: "완료", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/10" },
  };
  const { label, cls } = map[status];
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>{label}</span>;
}
