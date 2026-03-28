/**
 * COD-28 — EVACYCLE 전체 플로우 E2E 테스트
 *
 * 전제: 서버 localhost:3000(API) + localhost:3001(프론트) 실행 중
 * 시드 계정:
 *   - 폐차장: junkyard@evacycle.com
 *   - 허브:   hub@evacycle.com
 *   - 바이어: buyer@evacycle.com
 *   - 관리자: admin@evacycle.com
 */
import { test, expect } from '@playwright/test';
import axios from 'axios';
import { loginAs, getAccessToken } from './helpers/login';

const API = process.env.API_URL ?? 'http://localhost:3000/v1';

// 테스트 간 공유 상태 (순차 실행)
let caseId   = '';
let caseNo   = '';
let lotId    = '';
let listingId = '';

// ─── 1. 폐차장 로그인 ─────────────────────────────────────────────────────────
test('1. 폐차장 로그인', async ({ page }) => {
  await loginAs(page, 'junkyard@evacycle.com');
  await expect(page).toHaveURL(/\/cases/);
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

  // Step 2 — 파일 첨부 건너뛰기
  await expect(page.getByRole('button', { name: /건너뛰기|업로드/ })).toBeVisible();
  await page.getByRole('button', { name: /건너뛰기/ }).click();

  // Step 3 — 최종 확인 + 제출
  await expect(page.getByText('최종 확인')).toBeVisible();
  await page.getByRole('button', { name: '케이스 제출' }).click();

  // 케이스 상세 페이지로 이동
  await page.waitForURL(/\/cases\/.+$/, { timeout: 10000 });
  const url = page.url();
  caseId = url.split('/cases/')[1];
  expect(caseId).toBeTruthy();

  // 상태 SUBMITTED 확인
  await expect(page.getByText('SUBMITTED')).toBeVisible();
});

// ─── 3. 관리자 — 허브 조직 할당 ──────────────────────────────────────────────
test('3. 관리자 허브 조직 할당 (API)', async () => {
  // UI 불필요 — API 직접 호출
  const token = await getAccessToken('admin@evacycle.com');

  // 허브 조직 ID 조회 (시드 데이터)
  const orgsRes = await axios.get(`${API}/admin/organizations?type=HUB`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const hubOrg = orgsRes.data.data?.[0] ?? orgsRes.data[0];
  expect(hubOrg).toBeTruthy();

  // 케이스에 허브 할당
  await axios.patch(
    `${API}/admin/cases/${caseId}`,
    { hubOrgId: hubOrg.id },
    { headers: { Authorization: `Bearer ${token}` } },
  );
});

// ─── 4. 폐차장 — CoC 서명 ─────────────────────────────────────────────────────
test('4. 폐차장 CoC 서명 (운송 시작)', async ({ page }) => {
  await loginAs(page, 'junkyard@evacycle.com');
  await page.goto(`/cases/${caseId}`);

  await page.getByRole('button', { name: /CoC 서명/ }).click();
  await expect(page.getByText('CoC 서명 완료')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('IN_TRANSIT')).toBeVisible();
});

// ─── 5. 허브 — 입고 확인 ─────────────────────────────────────────────────────
test('5. 허브 입고 확인', async ({ page }) => {
  await loginAs(page, 'hub@evacycle.com');
  await page.goto(`/lots/intake/${caseId}`);

  await expect(page.getByRole('button', { name: '입고 확인' })).toBeEnabled({ timeout: 5000 });
  await page.getByRole('button', { name: '입고 확인' }).click();

  await expect(page.getByText('입고 확인 완료')).toBeVisible({ timeout: 8000 });
  await page.waitForURL(/\/lots/);
});

// ─── 6. 허브 — 그레이딩 + Lot 생성 ──────────────────────────────────────────
test('6. 허브 그레이딩 + Lot 생성', async ({ page }) => {
  await loginAs(page, 'hub@evacycle.com');
  await page.goto(`/lots/grading/${caseId}`);

  // 부품 유형 선택
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'BATTERY' }).click();

  // 중량 입력
  await page.getByLabel('중량').fill('75');

  // 재사용 등급
  await page.locator('[name="reuseGrade"]').selectOption?.('A');
  // Select 컴포넌트는 combobox role 사용
  const selects = page.getByRole('combobox');
  await selects.nth(1).click();
  await page.getByRole('option', { name: /A — 최상/ }).click();

  // 재활용 등급
  await selects.nth(2).click();
  await page.getByRole('option', { name: /R1 — 고순도/ }).click();

  // 라우팅 결정 — REUSE 카드 클릭
  await page.getByRole('button', { name: /REUSE/ }).click();

  // 제출
  await page.getByRole('button', { name: '감정 완료' }).click();
  await expect(page.getByText('그레이딩 완료')).toBeVisible({ timeout: 10000 });
  await page.waitForURL(/\/lots/);
});

// ─── 7. 허브 — Listing 등록 ──────────────────────────────────────────────────
test('7. 허브 Lot Listing 등록', async ({ page }) => {
  await loginAs(page, 'hub@evacycle.com');
  await page.goto('/lots');

  // 생성된 Lot 확인
  await expect(page.getByText('BATTERY')).toBeVisible({ timeout: 8000 });

  // Lot 상세 → Listing 생성
  await page.getByText('BATTERY').first().click();
  await page.waitForURL(/\/lots\/.+/);
  lotId = page.url().split('/lots/')[1];

  await page.getByRole('button', { name: /판매 등록|Listing/ }).click();
  await page.getByLabel(/가격|price/i).fill('1500000');
  await page.getByRole('button', { name: /등록 확인|등록/ }).click();

  await expect(page.getByText('Listing 등록 완료')).toBeVisible({ timeout: 8000 });
});

// ─── 8. 바이어 — 마켓플레이스 구매 ──────────────────────────────────────────
test('8. 바이어 마켓플레이스 구매', async ({ page }) => {
  await loginAs(page, 'buyer@evacycle.com');
  await page.goto('/marketplace');

  // BATTERY 카드 찾기
  await expect(page.getByText('BATTERY')).toBeVisible({ timeout: 8000 });
  await page.getByText('BATTERY').first().click();
  await page.waitForURL(/\/marketplace\/.+/);

  // 구매하기 버튼
  await page.getByRole('button', { name: '구매하기' }).click();

  // 모달 확인
  await expect(page.getByText('구매 확인')).toBeVisible();
  await page.getByRole('button', { name: '구매 확정' }).click();

  // 구매 완료 toast
  await expect(page.getByText(/구매 완료|구매가 확정/)).toBeVisible({ timeout: 10000 });
  await page.waitForURL(/\/marketplace\/orders/);
});

// ─── 9. 관리자 — 정산 확인 ───────────────────────────────────────────────────
test('9. 관리자 정산 1건 이상 확인', async ({ page }) => {
  await loginAs(page, 'admin@evacycle.com');
  await page.goto('/admin/settlements');

  // 정산 목록에 1건 이상 존재
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(1, { timeout: 8000 });
  // 최소 1건 이상이면 통과
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // PENDING 또는 APPROVED 상태의 정산이 존재
  await expect(page.getByText(/PENDING|APPROVED/)).toBeVisible();
});
