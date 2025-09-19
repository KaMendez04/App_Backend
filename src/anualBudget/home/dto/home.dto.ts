export interface Totals {
  incomes: number;
  spends: number;
  balance: number;
  projectedIncomes: number;
  projectedSpends: number;
  projectedBalance: number;
}

export interface ComparisonRow {
  id: number;
  name: string;
  real: number;
  projected: number;
  diff: number; // ÚNICO cálculo permitido en Home: real - projected
}
