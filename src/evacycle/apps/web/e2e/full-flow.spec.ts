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
 */
import { test, expect } from '@playwright/test';
import { loginAs, getAccessToken } from './helpers/login';

const API = process.env.API_URL ?? 'http://localhost:3000/v1';

// 순차 실행 간 공유 상태
const state = {
  caseId:    '',
  lotId:     '',
};

// ─── 1. 폐차장 로그인 ─────────────────────────────────────────────────────────
test('1. 폐차장 로그인', async ({ page }) => {
  await loginAs(page, 'junkyard@evacycle.com');
  await expect(page).toHaveURL(/\/cases/, { timeout: 5000 });
  await expect(page.locator('aside')).toContainText('EVACYCLE');
});

// ─── 2. 케이스 등록 위저드 ────────────────────────────────────────────────────
test('2. 케이스 등록 + 제출', async ({ page }) => {
  await loginAs(page, 'junkyard@evacycle.com');
  await page.goto('/cases/new');

  // Step 1 — 차량 정보
  await page.getByLabel('제조사').fill('현대');
  await page.getByLabel('모델명').fill('아이오닉5');
  await page.getByLabel('연식').fill('2023');
  await page.getByLabel(/VIN/).fill('KMHD341BXNU123456');
  await page.getByRole('button', { name: '다음' }).click();

  // Step 2 — 파일 건너뛰기
  await expect(
    page.getByRole('button', { name: /건너뛰기|업로드/ }),
  ).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /건너뛰기/ }).click();

  // Step 3 — 최종 확인 + 제출
  await expect(page.getByRole('button', { name: '케이스 제출' })).toBeVisible();
  await page.getByRole('button', { name: '케이스 제출' }).click();

  // 케이스 상세 페이지 이동 + ID 추출
  await page.waitForURL(/\/cases\/[0-9a-f]{8}-[0-9a-f]{4}-/, { timeout: 15000 });
  state.caseId = page.url().split('/cases/')[1];
  expect(state.caseId).toBeTruthy();

  await expect(page.getByText('SUBMITTED')).toBeVisible({ timeout: 5000 });
  console.log(`✅ Case ID: ${state.caseId}`);
});

// ─── 3. 관리자 — 허브 조직 할당 (API 직접) ────────────────────────────────────
test('3. 관리자 허브 할당', async () => {
  if (!state.caseId) test.skip();

  const token = await getAccessToken('admin@evacycle.com');

  // 허브 조직 목록 조회
  const orgsRes = await fetch(
    `${API}/admin/organizations?type=HUB&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const orgsData = await orgsRes.json();
  const hubOrg = orgsData.data?.[0] ?? orgsData[0];
  expect(hubOrg, '허브 조직이 없습니다. 시드 데이터를 확인하세요.').toBeTruthy();

  // 케이스에 허브 할당
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

  await page.getByRole('button', { name: /CoC 서명/ }).click();

  // toast 또는 상태 변경 확인
  await expect(
    page.getByText(/CoC 서명 완료|IN_TRANSIT/),
  ).toBeVisible({ timeout: 10000 });
});

// ─── 5. 허브 — 입고 확인 ─────────────────────────────────────────────────────
test('5. 허브 입고 확인', async ({ page }) => {
  if (!state.caseId) test.skip();

  await loginAs(page, 'hub@evacycle.com');
  await page.goto(`/lots/intake/${state.caseId}`);

  const btn = page.getByRole('button', { name: '입고 확인' });
  await expect(btn).toBeEnabled({ timeout: 8000 });
  await btn.click();

  await expect(
    page.getByText(/입고 확인 완료|RECEIVED/),
  ).toBeVisible({ timeout: 10000 });
});

// ─── 6. 허브 — 그레이딩 + Lot 생성 ──────────────────────────────────────────
test('6. 허브 그레이딩 + Lot 생성', async ({ page }) => {
  if (!state.caseId) test.skip();

  await loginAs(page, 'hub@evacycle.com');
  await page.goto(`/lots/grading/${state.caseId}`);

  // 부품 유형 선택 (첫 번째 Select)
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'BATTERY' }).click();

  // 중량 입력
  await page.getByLabel('중량').fill('75');

  // 재사용 등급 (두 번째 combobox)
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: /A — 최상/ }).click();

  // 재활용 등급 (세 번째 combobox)
  await page.getByRole('combobox').nth(2).click();
  await page.getByRole('option', { name: /R1 — 고순도/ }).click();

  // 라우팅 — REUSE 카드
  await page.getByRole('button', { name: /REUSE/ }).click();

  // 제출
  await page.getByRole('button', { name: '감정 완료' }).click();
  await expect(
    page.getByText(/그레이딩 완료|Lot 생성 완료/),
  ).toBeVisible({ timeout: 12000 });
  await page.waitForURL(/\/lots/, { timeout: 8000 });
});

// ─── 7. 허브 — Listing 등록 ──────────────────────────────────────────────────
test('7. Lot Listing 등록', async ({ page }) => {
  await loginAs(page, 'hub@evacycle.com');
  await page.goto('/lots');

  // Lot 목록에서 BATTERY 확인
  await expect(page.getByText('BATTERY')).toBeVisible({ timeout: 10000 });

  // 첫 번째 Lot 클릭
  await page.getByText('BATTERY').first().click();
  await page.waitForURL(/\/lots\/[a-z0-9-]+/, { timeout: 5000 });
  state.lotId = page.url().split('/lots/')[1];

  // 판매 등록 다이얼로그
  await page.getByRole('button', { name: /판매 등록|Listing/ }).click();
  await page.getByLabel(/가격|price/i).fill('1500000');
  await page.getByRole('button', { name: /등록 확인|등록/ }).click();

  await expect(
    page.getByText(/Listing 등록 완료|판매 등록 완료|ON_SALE|LISTED/),
  ).toBeVisible({ timeout: 10000 });
  console.log(`✅ Lot ID: ${state.lotId}`);
});

// ─── 8. 바이어 — 마켓플레이스 구매 ──────────────────────────────────────────
test('8. 바이어 마켓플레이스 구매', async ({ page }) => {
  await loginAs(page, 'buyer@evacycle.com');
  await page.goto('/marketplace');

  await expect(page.getByText('BATTERY')).toBeVisible({ timeout: 10000 });
  await page.getByText('BATTERY').first().click();
  await page.waitForURL(/\/marketplace\/[a-z0-9-]+/, { timeout: 5000 });

  // 구매하기 버튼
  await page.getByRole('button', { name: '구매하기' }).click();

  // 모달 확인 → 구매 확정
  await expect(page.getByText('구매 확인')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: '구매 확정' }).click();

  await expect(
    page.getByText(/구매 완료|구매가 확정/),
  ).toBeVisible({ timeout: 12000 });
  await page.waitForURL(/\/marketplace\/orders/, { timeout: 8000 });
});

// ─── 9. 관리자 — 정산 1건 이상 확인 ─────────────────────────────────────────
test('9. 관리자 정산 목록 확인', async ({ page }) => {
  await loginAs(page, 'admin@evacycle.com');
  await page.goto('/admin/settlements');

  // 정산 행 존재 확인
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 10000 });

  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(1);
  console.log(`✅ 정산 레코드: ${count}건`);

  await expect(page.getByText(/PENDING|APPROVED|PAID/)).toBeVisible();
});
