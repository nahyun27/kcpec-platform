/*
 * 화면 잘림 점검 — 주요 페이지를 폰/태블릿/PC 폭으로 열어서
 *   1) 페이지가 가로로 넘쳐 옆으로 스크롤되는 경우
 *   2) 내용이 감싸는 상자(overflow: hidden) 밖으로 튀어나와 잘려 보이는 경우
 * 를 찾아 출력한다. 2026-10 마이페이지 후기 작성 칸에서 다섯 번째 별이 잘린 일
 * 이후 배포 전에 돌려 보려고 만들었다.
 *
 * 사용: (프런트·백엔드를 로컬에서 띄운 뒤)
 *   PLAYWRIGHT_PATH=/path/to/node_modules/playwright \
 *   BASE_URL=http://localhost:3917 LOGIN_ID=... LOGIN_PW=... \
 *   node scripts/check-layout.cjs
 * LOGIN_ID 를 주면 로그인이 필요한 화면(마이페이지 등)도 본다.
 * 문제가 하나라도 있으면 종료 코드 1.
 */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

// 4px 이하는 일부러 살짝 내미는 경우(마우스 올렸을 때 배경 등)가 많아 무시한다.
const BASE = process.env.BASE_URL || "http://localhost:3917";
const WIDTHS = [360, 390, 768, 1280];

// [경로, 열고 나서 할 동작(선택)]
const ONLY = process.env.ONLY; // 경로 일부만 골라 볼 때
const PUBLIC_PAGES = [
  ["/"],
  ["/", async (p) => p.getByRole("button", { name: /후기 \d|후기 보기/ }).first().click()],
  ["/courses"],
  ["/courses/1"],
  ["/sentencing"],
  ["/counseling"],
  ["/detention"],
  ["/community"],
  ["/community?tab=review"],
  ["/guide"],
  ["/partner"],
  ["/partner/apply"],
  ["/login"],
  ["/signup"],
];
// ADMIN_ID/ADMIN_PW 를 주면 관리자 화면도 본다.
const ADMIN_PAGES = [
  ["/admin"],
  ["/admin/orders"],
  ["/admin/users"],
  ["/admin/documents"],
  ["/admin/legal-letters"],
  ["/admin/detention"],
  ["/admin/lawyer-partners"],
  ["/admin/community"],
  ["/admin/courses"],
  ["/admin/statistics"],
  ["/admin/health"],
];
const PRIVATE_PAGES = [
  ["/mypage"],
  ["/mypage", async (p) => p.getByRole("button", { name: "후기 쓰기" }).first().click()],
  ["/mypage?tab=orders"],
  ["/mypage?tab=counseling"],
  ["/checkout?course_id=1"],
  ["/checkout/bundle?courses=1"],
];

function scan() {
  const vw = window.innerWidth;
  const issues = [];
  const docW = document.documentElement.scrollWidth;
  if (docW > vw + 1) issues.push({ kind: "가로 넘침(옆으로 스크롤됨)", px: docW - vw, where: "page" });

  const reported = [];
  const describe = (el) => {
    const cls = (el.getAttribute("class") || "").split(/\s+/).slice(0, 4).join(".");
    const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };
  for (const el of document.querySelectorAll("body *")) {
    if (["IMG", "VIDEO", "IFRAME", "PICTURE", "SOURCE", "CANVAS"].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none") continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    // 글자 없는 absolute 장식(배경 빛 번짐, 버튼 반짝임 효과 등)은 일부러 밖으로 나간다.
    if ((cs.position === "absolute" || cs.position === "fixed") && !(el.innerText || "").trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    // 칸보다 내용이 넓은 경우 — 옆 칸에 가려지거나 겹친다(2026-10 별점 다섯 번째
    // 별이 옆 "수강 과정" 칸에 가려진 경우가 이것).
    if (
      cs.overflowX === "visible" &&
      el.scrollWidth > el.clientWidth + 2 &&
      el.clientWidth > 0 &&
      !["inline", "contents"].includes(cs.display) &&
      !reported.some((x) => x.contains(el) || el.contains(x))
    ) {
      const kids = [...el.children].filter((k) => {
        const kcs = getComputedStyle(k);
        return kcs.position !== "absolute" && kcs.position !== "fixed" && kcs.display !== "none";
      });
      const er = el.getBoundingClientRect();
      const out = Math.max(0, ...kids.map((k) => k.getBoundingClientRect().right - er.right));
      if (out > 4) {
        reported.push(el);
        issues.push({ kind: "내용이 칸보다 넓음(옆과 겹침)", px: Math.round(out), where: describe(el) });
        continue;
      }
    }

    // 가장 가까운 "자르는" 조상
    let a = el.parentElement;
    while (a && a !== document.body && getComputedStyle(a).overflowX === "visible") a = a.parentElement;
    if (!a || a === document.body) continue;
    const acs = getComputedStyle(a);
    if (acs.overflowX === "auto" || acs.overflowX === "scroll") continue; // 일부러 가로 스크롤
    if (acs.textOverflow === "ellipsis" || acs.webkitLineClamp !== "none") continue; // 말줄임
    const ar = a.getBoundingClientRect();
    if (ar.width < 2) continue;
    // 글자 없는 장식이 absolute 상자 안에 들어 있는 경우(버튼 반짝임 띠 등)도 일부러 나간다.
    if (!(el.innerText || "").trim()) {
      let n = el, deco = false;
      while (n && n !== a) {
        const p = getComputedStyle(n).position;
        if (p === "absolute" || p === "fixed") { deco = true; break; }
        n = n.parentElement;
      }
      if (deco) continue;
    }
    const over = Math.max(r.right - ar.right, ar.left - r.left);
    if (over <= 4) continue;
    if (reported.some((x) => x.contains(el))) continue; // 바깥 것 하나만
    reported.push(el);
    issues.push({ kind: "상자 밖으로 잘림", px: Math.round(over), where: describe(el), box: describe(a) });
  }
  return issues;
}

(async () => {
  const browser = await chromium.launch();
  let total = 0;
  // 로그인은 한 번만 하고 세션을 재사용한다(사이트의 로그인 횟수 제한에 걸리지 않게).
  let session;
  const login = async (id = process.env.LOGIN_ID, pw = process.env.LOGIN_PW) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // 화면이 다 준비되기 전에 입력하면 값이 날아간다
    await page.locator("input").first().fill(id);
    await page.locator('input[type="password"]').first().fill(pw);
    await page.locator("form button[type=submit]").first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
    if (page.url().includes("/login")) throw new Error("로그인 실패 — LOGIN_ID/LOGIN_PW 확인");
    session = await ctx.storageState();
    await ctx.close();
  };
  const run = async (pages, loggedIn) => {
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: 900 },
        ...(loggedIn ? { storageState: session } : {}),
      });
      const page = await ctx.newPage();
      for (const [path, action] of pages) {
        if (ONLY && !path.includes(ONLY)) continue;
        try {
          await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(1500);
          if (action) {
            await action(page);
            await page.waitForTimeout(1200);
          }
          const issues = await page.evaluate(scan);
          for (const i of issues) {
            total++;
            console.log(`[${w}px] ${path}${action ? " (+동작)" : ""} — ${i.kind} ${i.px}px: ${i.where}${i.box ? `  ⟵ ${i.box}` : ""}`);
          }
        } catch (e) {
          console.log(`[${w}px] ${path} — 열기 실패: ${String(e.message).split("\n")[0]}`);
        }
      }
      await ctx.close();
    }
  };
  await run(PUBLIC_PAGES, false);
  if (process.env.LOGIN_ID) {
    await login();
    await run(PRIVATE_PAGES, true);
  }
  if (process.env.ADMIN_ID) {
    await login(process.env.ADMIN_ID, process.env.ADMIN_PW);
    await run(ADMIN_PAGES, true);
  }
  await browser.close();
  console.log(total ? `\n문제 ${total}건` : "\n문제 없음");
  process.exit(total ? 1 : 0);
})();
