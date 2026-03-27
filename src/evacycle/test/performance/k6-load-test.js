import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Custom Metrics ────────────────────────────────────────────────
const loginDuration = new Trend('login_duration', true);
const caseListDuration = new Trend('case_list_duration', true);
const lotListDuration = new Trend('lot_list_duration', true);
const marketplaceDuration = new Trend('marketplace_duration', true);
const errorRate = new Rate('errors');

// ─── Test Configuration ────────────────────────────────────────────
export const options = {
  vus: 50,
  duration: '30s',

  thresholds: {
    http_req_duration: ['p(95)<500'],        // 전체 P95 < 500ms
    login_duration: ['p(95)<800'],           // 로그인 P95 < 800ms
    case_list_duration: ['p(95)<400'],       // Case 목록 P95 < 400ms
    lot_list_duration: ['p(95)<400'],        // Lot 목록 P95 < 400ms
    marketplace_duration: ['p(95)<300'],     // 마켓플레이스 P95 < 300ms
    errors: ['rate<0.1'],                    // 에러율 < 10%
    http_req_failed: ['rate<0.1'],           // HTTP 실패율 < 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@evacycle.test';
const TEST_OTP = __ENV.TEST_OTP || '000000';

// ─── Helpers ───────────────────────────────────────────────────────
function getAuthHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

// ─── Setup: 인증 토큰 획득 ─────────────────────────────────────────
export function setup() {
  // OTP 발송
  const sendRes = http.post(
    `${BASE_URL}/v1/auth/otp/send`,
    JSON.stringify({ email: TEST_EMAIL }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (sendRes.status !== 200 && sendRes.status !== 201) {
    console.warn(`OTP send failed (${sendRes.status}) - tests will run without auth`);
    return { token: null };
  }

  // OTP 검증 → JWT 토큰
  const verifyRes = http.post(
    `${BASE_URL}/v1/auth/otp/verify`,
    JSON.stringify({ email: TEST_EMAIL, code: TEST_OTP }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (verifyRes.status !== 200 && verifyRes.status !== 201) {
    console.warn(`OTP verify failed (${verifyRes.status}) - tests will run without auth`);
    return { token: null };
  }

  const body = JSON.parse(verifyRes.body);
  return { token: body.accessToken || body.access_token };
}

// ─── Main Scenario ─────────────────────────────────────────────────
export default function (data) {
  const token = data.token;
  const params = token ? getAuthHeaders(token) : { headers: { 'Content-Type': 'application/json' } };

  // 1) Health Check
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health: status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(0.3);

  // 2) 로그인 (OTP 발송 + 검증)
  group('Login Flow', () => {
    const start = Date.now();

    const sendRes = http.post(
      `${BASE_URL}/v1/auth/otp/send`,
      JSON.stringify({ email: TEST_EMAIL }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    const verifyRes = http.post(
      `${BASE_URL}/v1/auth/otp/verify`,
      JSON.stringify({ email: TEST_EMAIL, code: TEST_OTP }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    loginDuration.add(Date.now() - start);

    const ok = check(verifyRes, {
      'login: status 2xx': (r) => r.status >= 200 && r.status < 300,
    });
    if (!ok) errorRate.add(1);
  });

  sleep(0.5);

  // 3) Case 목록 조회
  group('Case List', () => {
    const res = http.get(`${BASE_URL}/v1/cases?skip=0&take=20`, params);
    caseListDuration.add(res.timings.duration);

    const ok = check(res, {
      'cases: status 2xx': (r) => r.status >= 200 && r.status < 300,
      'cases: has body': (r) => r.body && r.body.length > 0,
    });
    if (!ok) errorRate.add(1);
  });

  sleep(0.3);

  // 4) Lot 목록 조회
  group('Lot List', () => {
    const res = http.get(`${BASE_URL}/v1/lots?skip=0&take=20`, params);
    lotListDuration.add(res.timings.duration);

    const ok = check(res, {
      'lots: status 2xx': (r) => r.status >= 200 && r.status < 300,
      'lots: has body': (r) => r.body && r.body.length > 0,
    });
    if (!ok) errorRate.add(1);
  });

  sleep(0.3);

  // 5) 마켓플레이스 (Lot 목록 + 상세)
  group('Marketplace', () => {
    // 마켓플레이스 목록 (LISTED 상태 필터)
    const listRes = http.get(
      `${BASE_URL}/v1/lots?status=LISTED&skip=0&take=10`,
      params,
    );
    marketplaceDuration.add(listRes.timings.duration);

    const listOk = check(listRes, {
      'marketplace list: status 2xx': (r) => r.status >= 200 && r.status < 300,
    });
    if (!listOk) errorRate.add(1);

    // 첫 번째 Lot 상세 조회
    if (listRes.status === 200) {
      try {
        const lots = JSON.parse(listRes.body);
        const items = Array.isArray(lots) ? lots : lots.data || lots.items || [];
        if (items.length > 0) {
          const detailRes = http.get(`${BASE_URL}/v1/lots/${items[0].id}`, params);
          check(detailRes, {
            'marketplace detail: status 2xx': (r) => r.status >= 200 && r.status < 300,
          }) || errorRate.add(1);
        }
      } catch (_) {
        // 파싱 실패 시 무시
      }
    }
  });

  sleep(0.5);

  // 6) 내 정보 조회
  if (token) {
    group('Auth Me', () => {
      const res = http.get(`${BASE_URL}/v1/auth/me`, params);
      check(res, {
        'me: status 2xx': (r) => r.status >= 200 && r.status < 300,
      }) || errorRate.add(1);
    });
  }

  sleep(0.3);
}

// ─── Summary ───────────────────────────────────────────────────────
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    vus: options.vus,
    duration: options.duration,
    thresholds: {},
    metrics: {},
  };

  for (const [name, threshold] of Object.entries(data.metrics)) {
    if (threshold.thresholds) {
      summary.thresholds[name] = threshold.thresholds;
    }
    if (threshold.values) {
      summary.metrics[name] = threshold.values;
    }
  }

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'k6-results.json': JSON.stringify(summary, null, 2),
  };
}

// k6 built-in text summary
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';
