import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Custom metrics
const casesCreated = new Counter('cases_created');
const transitionDuration = new Trend('transition_duration', true);

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Stage 1: Ramp-up
    { duration: '60s', target: 10 },   // Stage 2: Sustain
    { duration: '30s', target: 50 },   // Stage 3: Peak
    { duration: '30s', target: 10 },   // Stage 4: Ramp-down
    { duration: '10s', target: 0 },    // Stage 5: Idle
  ],
  thresholds: {
    'http_req_duration{name:auth}': ['p(95)<200'],         // 로그인 P95 <200ms
    'http_req_duration{name:caseList}': ['p(95)<300'],     // Case목록 P95 <300ms
    'http_req_duration{name:lotList}': ['p(95)<300'],      // Lot목록 P95 <300ms
    'http_req_duration{name:createCase}': ['p(95)<300'],
    'http_req_duration{name:transition}': ['p(95)<500'],
    'http_req_duration{name:timeline}': ['p(95)<500'],
    'http_req_duration{name:dashboard}': ['p(95)<1000'],
    'http_req_duration{name:verifyChain}': ['p(95)<1000'],
    'http_req_failed': ['rate<0.01'], // 에러율 1% 미만
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/v1';

// 테스트 환경 인증 토큰 (사전 발급 또는 OTP bypass)
function getAuthToken(email, role) {
  const authRes = http.post(
    `${BASE_URL}/auth/otp/verify`,
    JSON.stringify({
      email: email,
      otp: '000000', // 테스트 환경 고정 OTP
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth' },
    },
  );

  if (authRes.status === 200 || authRes.status === 201) {
    return authRes.json('accessToken');
  }
  return null;
}

export default function () {
  const vuId = __VU;
  const iterationId = __ITER;

  // 사전 발급된 토큰 사용 (환경변수 또는 하드코딩)
  const yardToken = __ENV.YARD_TOKEN || 'test-token';
  const hubToken = __ENV.HUB_TOKEN || 'test-token';
  const adminToken = __ENV.ADMIN_TOKEN || 'test-token';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${yardToken}`,
  };

  group('List Endpoints SLA', () => {
    // Case 목록 조회
    const caseListRes = http.get(`${BASE_URL}/cases`, {
      headers,
      tags: { name: 'caseList' },
    });

    check(caseListRes, {
      'case list ok (200)': (r) => r.status === 200,
    });

    // Lot 목록 조회
    const lotListRes = http.get(`${BASE_URL}/lots`, {
      headers,
      tags: { name: 'lotList' },
    });

    check(lotListRes, {
      'lot list ok (200)': (r) => r.status === 200,
    });
  });

  group('Case Lifecycle', () => {
    // 1. Case 생성
    const caseRes = http.post(
      `${BASE_URL}/cases`,
      JSON.stringify({
        vehicleMaker: '현대',
        vehicleModel: `모델-VU${vuId}-${iterationId}`,
        vehicleYear: 2020 + (iterationId % 5),
        vin: `PERF${String(vuId).padStart(4, '0')}${String(iterationId).padStart(9, '0')}`,
      }),
      { headers, tags: { name: 'createCase' } },
    );

    const caseCreated = check(caseRes, {
      'case created (201)': (r) => r.status === 201,
      'has caseNo': (r) => r.json('caseNo') !== undefined,
    });

    if (!caseCreated) return;
    casesCreated.add(1);

    const caseId = caseRes.json('id');

    // 2. Submit (DRAFT → SUBMITTED)
    const submitRes = http.post(`${BASE_URL}/cases/${caseId}/submit`, null, {
      headers,
      tags: { name: 'transition' },
    });

    check(submitRes, {
      'submitted (201)': (r) => r.status === 201,
    });
    transitionDuration.add(submitRes.timings.duration);

    // 3. CoC Signed (SUBMITTED → IN_TRANSIT)
    const cocRes = http.post(
      `${BASE_URL}/cases/${caseId}/transition`,
      JSON.stringify({
        eventType: 'COC_SIGNED',
        payload: { signedBy: `VU-${vuId}`, signedAt: new Date().toISOString() },
      }),
      { headers, tags: { name: 'transition' } },
    );

    check(cocRes, {
      'coc signed (201)': (r) => r.status === 201,
    });
    transitionDuration.add(cocRes.timings.duration);

    // 4. Timeline 조회
    const timelineRes = http.get(`${BASE_URL}/cases/${caseId}/timeline`, {
      headers,
      tags: { name: 'timeline' },
    });

    check(timelineRes, {
      'timeline ok (200)': (r) => r.status === 200,
      'has events': (r) => {
        const body = r.json();
        return body.timeline && body.timeline.length >= 2;
      },
    });

    // 5. Hash Chain 검증
    const verifyHeaders = {
      ...headers,
      Authorization: `Bearer ${adminToken}`,
    };
    const verifyRes = http.get(
      `${BASE_URL}/admin/ledger/verify?caseId=${caseId}`,
      { headers: verifyHeaders, tags: { name: 'verifyChain' } },
    );

    check(verifyRes, {
      'verify ok (200)': (r) => r.status === 200,
      'chain valid': (r) => r.json('valid') === true,
    });
  });

  group('Admin Dashboard', () => {
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    const dashRes = http.get(`${BASE_URL}/admin/dashboard`, {
      headers: adminHeaders,
      tags: { name: 'dashboard' },
    });

    check(dashRes, {
      'dashboard ok (200)': (r) => r.status === 200,
      'has stats': (r) => r.json('cases') !== undefined,
    });
  });

  sleep(1);
}

// Setup — 사전 데이터 생성 (VU 시작 전)
export function setup() {
  console.log(`k6 Load Test — EVACYCLE API`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Ensure test DB is seeded and auth tokens are available.`);
  return {};
}

// Teardown — 결과 요약
export function teardown(data) {
  console.log('Load test completed.');
}

// 커스텀 리포트 출력
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
