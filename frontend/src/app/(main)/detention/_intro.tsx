import { BookOpenCheck, FileCheck2, Mail, PackageCheck } from "lucide-react";

// 서버 컴포넌트 — 검색엔진이 읽을 수 있도록 설명 영역은 서버에서 렌더링한다.
// 결과(감형·집행유예 등)를 약속하는 문구, 사례·후기·전문가 발언은 넣지 않는다.
export default function DetentionIntro() {
  return (
    <>
      <div className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
            Detention Education
          </p>
          <h1 className="mt-2 font-sans text-3xl font-black text-slate-900">
            구속수용자 재범방지교육
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            구치소·교도소에 계셔서 온라인 수강이 어려운 분을 위해, 보호자께서 대신 신청하시면
            교육자료를 수용시설로 우편 발송해 드립니다. 교육 이수 후 수료증은 이메일로 발급해
            드립니다.
          </p>
          <a
            href="#apply"
            className="mt-6 inline-flex items-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-[var(--color-primary-hover)]"
          >
            신청하러 가기
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-12 px-6 pt-10">
        <section>
          <h2 className="font-sans text-xl font-bold text-slate-900">보호자분께</h2>
          <div className="mt-5 space-y-3 rounded-xl border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-slate-600">
            <p>
              가족이 수감되어 있으면 무엇을 준비해야 할지 막막하실 수 있습니다. 수감 중에는 본인이
              직접 준비할 수 있는 범위가 제한적이라, 신청과 결제는 보호자께서 대신 진행하실 수
              있도록 만들었습니다.
            </p>
            <p>
              신청하실 때 수용자의 정보와 수용시설 주소만 입력하시면, 교육자료 발송은 저희가
              진행합니다. 결제부터 수료증 수령까지 이 페이지에서 순서대로 안내해 드립니다.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-sans text-xl font-bold text-slate-900">이용 절차</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                icon: FileCheck2,
                t: "1. 신청·결제",
                d: "보호자가 수용자 정보를 입력하고 교육과정을 선택해 결제합니다.",
              },
              {
                icon: PackageCheck,
                t: "2. 교육자료 발송",
                d: "결제 확인 후 발송을 준비해, 신청 당일~다음 날 수용시설 주소로 우편 발송합니다.",
              },
              {
                icon: BookOpenCheck,
                t: "3. 수용자 학습",
                d: "수용자가 교육자료로 학습합니다. 교육자료 안에 퀴즈가 포함되어 있습니다.",
              },
              {
                icon: Mail,
                t: "4. 학습 확인·수료증 발급",
                d: "발송 7일 후 신청하신 분이 마이페이지에서 '학습 완료 확인'을 누르면, 수료증을 신청 시 입력한 이메일로 보내드립니다.",
              },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
                <div>
                  <p className="text-sm font-bold text-slate-800">{t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="font-sans text-xl font-bold text-slate-900">진행 기간 안내</h2>
          <dl className="mt-5 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm">
            {[
              ["교육자료 발송", "신청 당일 ~ 다음 날"],
              ["자료 도착", "수용시설·우편 사정에 따라 달라집니다"],
              ["학습 완료 확인", "교육자료 발송일로부터 7일 후부터 가능"],
              ["수료증 발송", "학습 완료 확인 후 발급하여 이메일로 발송"],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                <dt className="font-bold text-slate-700">{k}</dt>
                <dd className="text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="font-sans text-xl font-bold text-slate-900">유의사항</h2>
          <ul className="mt-5 list-disc space-y-2 rounded-xl border border-amber-200 bg-amber-50 py-5 pl-9 pr-5 text-sm leading-relaxed text-amber-900">
            <li>교육자료는 신청 즉시 발송 준비에 들어가므로, 신청·결제 후에는 환불이 어렵습니다.</li>
            <li>수용시설의 규정과 우편 사정에 따라 자료 도착이 늦어지거나 반입이 제한될 수 있습니다.</li>
            <li>수료증은 교육 이수를 증명하는 자료이며, 재판·수사 결과를 보장하지 않습니다.</li>
            <li>
              수용자의 성명·생년월일·수용번호·시설 정보는 교육자료 발송과 수료증 발급 목적으로만
              사용됩니다.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
