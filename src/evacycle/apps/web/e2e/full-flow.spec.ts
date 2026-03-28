/**
 * COD-28 — EVACYCLE 전체 플로우 E2E 테스트
 *
 * 전제:
 *   - localhost:3000 (NestJS API, NODE_ENV=development)
 *   - localhost:3001 (Next.js 프론트엔드)
 *
 * 시드 계정 (prisma/seed.ts 기준):
 *   - 폐차장: junkyard@evacycle.com
 *   - 허브:   hub@evacycle.com
 *   - 바이어: buyer@evacycle.com
 *   - 관리자: admin@evacycle.com
 *
 * 버튼/텍스트 매핑 (실제 UI 기준):
 *   - Step1 다음 버튼: type="button" + text "다음"
 *   - Step2 파일없음: text "건너뛰기"
 *   - Step3 제출: text "케이스 제출"
 *   - CoC 서명: text "CoC 서명 (운송 시작)"
 *   - 감정 완료: type="submit" + text "감정 완료"
 *   - Routing REUSE: type="button" + text "♻️ 재사용 (REUSE)"
 *   - Listing 생성 트리거: text "Listing 생성"
 *   - Listing 등록 제출: text "Listing 등록"
 *   - 상세 보기: role=link + text "상세 보기"
 *   - 구매하기: text "구매하기"
 *   - 구매 확정: text "구매 확정"
 *   - CaseStatus: SUBMITTED → "제출됨", IN_TRANSIT → "운송중", RECEIVED → "입고됨"
 *   - SettlementStatus: PENDING → "대기중", APPROVED → "승인됨", PAID → "지급완료"
 */
import { test, expect } from '@playwright/test';
import { loginAs, getAccessToken } from './helpers/login';

const API = process.env.API_URL ?? 'http://localhost:3000/v1';

// 순차 실행 간 공유 상태
const state = {
  caseId: '',
  lotId:  '',
};

// ─── 1. 폐차장 로그인 ─────────────────────────────────────────────────────────
test('1. 폐차장 로그인', async ({ page }) => {
  await loginAs(page, 'junkyard@evacycle.com');
  await expect(page).toHaveURL(/\/cases/, { timeout: 8000 });
  await expect(page.locator('aside')).toContainText('EVACYCLE');
});

// ─── 2. 케이스 등록 위저드 ────────────────────────────────────────────────────
test('2. 케이스 등록 + 제출', async ({ page }) => {
  await loginAs(page, 'junkyard@evacycle.com');
  await page.goto('/cases/new');

  // Step 1 — 차량 정보 입력
  // VIN 고유값 (매 실행마다 달라야 중복 방지)
  const vin = `KMH${Date.now().toString().slice(-12)}AB`.slice(0, 17);
  await page.getByLabel('제조사').fill('현대');
  await page.getByLabel('모델명').fill('아이오닉5');
  await page.getByLabel('연식').fill('2023');
  await page.getByLabel(/VIN/).fill(vin);

  // "다음" 버튼 (type="button" + onClick={form.handleSubmit(onNext)})
  await page.getByRole('button', { name: /^다음/ }).click();

  // Step 2 — 파일 없음 → "건너뛰기" 버튼
  await expect(
    page.getByRole('button', { name: '건너뛰기' }),
  ).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: '건너뛰기' }).click();

  // Step 3 — 최종 확인 → "케이스 제출" 버튼
  await expect(
    page.getByRole('button', { name: '케이스 제출' }),
  ).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: '케이스 제출' }).click();

  // 케이스 상세 페이지로 이동 + ID 추출
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}/, { timeout: 15000 });
  state.caseId = page.url().split('/cases/')[1];
  expect(state.caseId).toBeTruthy();

  // SUBMITTED → 한글 "제출됨" 뱃지
  await expect(page.getByText('제출됨').first()).toBeVisible({ timeout: 8000 });
  console.log(`✅ Case ID: ${state.caseId}`);
});

// ─── 3. 관리자 — 허브 조직 할당 (API 직접) ────────────────────────────────────
test('3. 관리자 허브 할당', async () => {
  if (!state.caseId) test.skip();

  const token = await getAccessToken('admin@evacycle.com');

  // HUB 조직 조회 (COD-27: PaginatedResponse → data[])
  const orgsRes = await fetch(`${API}/admin/organizations?type=HUB&limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const orgsData = await orgsRes.json();
  const hubOrg = orgsData.data?.[0] ?? orgsData[0];
  expect(hubOrg, '허브 조직 없음 — 시드 데이터 확인').toBeTruthy();

  const patchRes = await fetch(`${API}/admin/cases/${state.caseId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ hubOrgId: hubOrg.id }),
  });
  expect(patchRes.status).toBe(200);
  console.log(`✅ hubOrgId: ${hubOrg.id}`);
});

// ─── 4. 폐차장 — CoC 서명 ─────────────────────────────────────────────────────
test('4. 폐차장 CoC 서명 (운송 시작)', async ({ page }) => {
  if (!state.caseId) test.skip();

  await loginAs(page, 'junkyard@evacycle.com');
  await page.goto(`/cases/${state.caseId}`);

  // 버튼 텍스트: "CoC 서명 (운송 시작)"
  await page.getByRole('button', { name: /CoC 서명/ }).click();

  // toast: "CoC 서명 완료" 또는 상태 뱃지: "운송중"
  await expect(
    page.getByText(/CoC 서명 완료|운송중/).first(),
  ).toBeVisible({ timeout: 12000 });
});

// ─── 5. 허브 — 입고 확인 ─────────────────────────────────────────────────────
test('5. 허브 입고 확인', async ({ page }) => {
  if (!state.caseId) test.skip();

  await loginAs(page, 'hub@evacycle.com');
  await page.goto(`/lots/intake/${state.caseId}`);

  const btn = page.getByRole('button', { name: '입고 확인' });
  await expect(btn).toBeEnabled({ timeout: 8000 });
  await btn.click();

  // toast 또는 상태: "입고됨"
  await expect(
    page.getByText(/입고 확인 완료|입고됨/).first(),
  ).toBeVisible({ timeout: 12000 });
});

// ─── 6. 허브 — 그레이딩 + Lot 생성 ──────────────────────────────────────────
test('6. 허브 그레이딩 + Lot 생성', async ({ page }) => {
  if (!state.caseId) test.skip();

  await loginAs(page, 'hub@evacycle.com');
  await page.goto(`/lots/grading/${state.caseId}`);
  await page.waitForSelector('[role="combobox"]', { timeout: 8000 });

  // PartType Select (첫 번째 combobox)
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'BATTERY' }).click();

  // 중량 (FormLabel: "중량 (kg)")
  const weightInput = page.getByLabel(/중량/);
  await weightInput.clear();
  await weightInput.fill('75');

  // Reuse Grade Select (두 번째 combobox) — "A — 최상"
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'A — 최상' }).click();

  // Recycle Grade Select (세 번째 combobox) — "R1 — 고순도"
  await page.getByRole('combobox').nth(2).click();
  await page.getByRole('option', { name: 'R1 — 고순도' }).click();

  // Routing Decision — "♻️ 재사용 (REUSE)" type="button"
  await page.getByRole('button', { name: /재사용.*REUSE|REUSE.*재사용/ }).click();

  // "감정 완료" 제출 (type="submit")
  await page.getByRole('button', { name: '감정 완료' }).click();

  // Lot 생성 toast 확인 후 /lots로 이동
  await expect(
    page.getByText(/Lot 생성 완료|그레이딩 완료/).first(),
  ).toBeVisible({ timeout: 12000 });
  await page.waitForURL(
    (url) => {
      const p = new URL(url).pathname;
      return (
        p === '/lots' ||
        (p.startsWith('/lots/') && !p.includes('/grading') && !p.includes('/intake'))
      );
    },
    { timeout: 15000 },
  );

  // Lot ID 추출 (API 조회)
  const token = await getAccessToken('hub@evacycle.com');
  const lotsRes = await fetch(`${API}/cases/${state.caseId}/lots`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (lotsRes.ok) {
    const lotsData = await lotsRes.json();
    const lots = Array.isArray(lotsData)
      ? lotsData
      : (lotsData.data ?? lotsData.items ?? []);
    state.lotId = lots[0]?.id ?? '';
  }
  console.log(`✅ Lot ID: ${state.lotId || '(조회 실패)'}`);
});

// ─── 7. 허브 — Listing 등록 ──────────────────────────────────────────────────
test('7. Lot Listing 등록', async ({ page }) => {
  // state.lotId 없으면 API로 최신 Lot 조회
  if (!state.lotId && state.caseId) {
    const token = await getAccessToken('hub@evacycle.com');
    const lotsRes = await fetch(`${API}/cases/${state.caseId}/lots`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (lotsRes.ok) {
      const lotsData = await lotsRes.json();
      const lots = Array.isArray(lotsData)
        ? lotsData
        : (lotsData.data ?? lotsData.items ?? []);
      state.lotId = lots[0]?.id ?? '';
    }
  }
  if (!state.lotId) { console.warn('Lot ID 없음 — 6번 테스트 선행 필요'); test.skip(); return; }

  await loginAs(page, 'hub@evacycle.com');
  await page.goto(`/lots/${state.lotId}`);

  // "Listing 생성" 버튼 → 다이얼로그 열기
  await page.getByRole('button', { name: 'Listing 생성' }).click();

  // 다이얼로그 타이틀: "고정가 Listing 생성"
  await expect(page.getByText('고정가 Listing 생성')).toBeVisible({ timeout: 5000 });

  // FormLabel: "판매 가격 (원)"
  await page.getByLabel('판매 가격 (원)').fill('1500000');

  // 제출 버튼: "Listing 등록"
  await page.getByRole('button', { name: 'Listing 등록' }).click();

  // toast: "Listing 생성 완료"
  await expect(
    page.getByText('Listing 생성 완료').first(),
  ).toBeVisible({ timeout: 10000 });
  console.log(`✅ Lot ID: ${state.lotId} — Listing 등록 완료`);
});

// ─── 8. 바이어 — 마켓플레이스 구매 ──────────────────────────────────────────
test('8. 바이어 마켓플레이스 구매', async ({ page }) => {
  // state.lotId가 있으면 직접 해당 lot으로 이동 (7번 연계)
  // 없으면 API로 ON_SALE 상태 Lot 조회 → marketplace/{id}로 직접 이동
  let targetLotId = state.lotId;

  if (!targetLotId) {
    const token = await getAccessToken('buyer@evacycle.com');
    const lotsRes = await fetch(`${API}/lots?status=ON_SALE&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (lotsRes.ok) {
      const lotsData = await lotsRes.json();
      const lots = Array.isArray(lotsData)
        ? lotsData
        : (lotsData.data ?? lotsData.items ?? []);
      targetLotId = lots[0]?.id ?? '';
    }
  }

  if (!targetLotId) {
    console.warn('ON_SALE Lot 없음 — 7번 테스트 선행 또는 시드 데이터 필요');
    test.skip();
    return;
  }

  await loginAs(page, 'buyer@evacycle.com');
  // lot id로 직접 상세 페이지 이동 (카탈로그 탐색 불필요)
  await page.goto(`/marketplace/${targetLotId}`);
  await page.waitForURL(/\/marketplace\/[0-9a-f-]{36}/, { timeout: 10000 });

  // "구매하기" 버튼
  await page.getByRole('button', { name: '구매하기' }).click();

  // AlertDialog: 타이틀 "구매 확인", 버튼 "구매 확정"
  await expect(page.getByText('구매 확인')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: '구매 확정' }).click();

  // toast: "🎉 구매 완료!"
  await expect(
    page.getByText(/구매 완료|구매가 확정/).first(),
  ).toBeVisible({ timeout: 12000 });
  await page.waitForURL(/\/marketplace\/orders/, { timeout: 10000 });
});

// ─── 9. 관리자 — 정산 1건 이상 확인 ─────────────────────────────────────────
test('9. 관리자 정산 목록 확인', async ({ page }) => {
  await loginAs(page, 'admin@evacycle.com');
  await page.goto('/admin/settlements');

  // 테이블 행 1건 이상
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 12000 });

  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(1);
  console.log(`✅ 정산 레코드: ${count}건`);

  // 상태 뱃지: "대기중" | "승인됨" | "지급완료"
  await expect(
    page.getByText(/대기중|승인됨|지급완료/).first(),
  ).toBeVisible({ timeout: 5000 });
});
