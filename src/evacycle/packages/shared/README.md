# packages/shared — 공유 타입 & 유틸리티

`apps/web`과 `apps/api`가 공통으로 사용하는 TypeScript 타입, DTO, 유틸 함수를 모아둔다.

## 포함 예정

- `types/` — Battery, User, Transaction 등 도메인 타입
- `dto/` — 요청/응답 DTO
- `utils/` — 날짜, 포맷 등 공용 유틸

## 사용법

```ts
import { BatteryStatus } from '@evacycle/shared';
```
