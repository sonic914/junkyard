# packages/blockchain — IBlockchainAdapter

블록체인 연동 추상화 레이어. 체인 종류에 상관없이 동일한 인터페이스로 배터리 이력을 온체인에 기록한다.

## 설계 원칙

- `IBlockchainAdapter` 인터페이스를 정의
- 구현체는 체인별로 분리 (Ethereum, Polygon 등)
- `apps/api`는 인터페이스만 의존 — 체인 교체 시 코드 변경 최소화

## 인터페이스 (예정)

```ts
export interface IBlockchainAdapter {
  recordBattery(batteryId: string, data: BatteryRecord): Promise<TxHash>;
  getHistory(batteryId: string): Promise<BatteryRecord[]>;
  verifyRecord(txHash: TxHash): Promise<boolean>;
}
```

Arlo의 설계가 확정되면 구현 착수.
