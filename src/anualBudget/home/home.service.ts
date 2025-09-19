import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Totals, ComparisonRow } from './dto/home.dto';

// Totales (ya calculados en tus servicios)
import { TotalSumService } from '../totalSum/total-sum.service';
import { PTotalSumService } from '../pTotalSum/p-total-sum.service';

// Nombres de departamentos
import { Department } from '../department/entities/department.entity';

// INGRESOS (ya funcionando)
import { IncomeTypeByDepartmentService } from '../incomeTypeByDeparment/income-type-by-department.service';
import { PIncomeTypeByDepartmentService } from '../pIncomeTypeByDeparment/p-income-type-by-department.service';
import { SpendTypeByDepartmentService } from '../spendTypeByDepartment/spend-type-by-department.service';
import { PSpendTypeByDepartmentService } from '../pSpendTypeByDepartment/p-spend-type-by-department.service';

// EGRESOS (new)



type GroupBy = 'department' | 'type' | 'subtype';

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(
    // cards
    private readonly totalSumSvc: TotalSumService,
    private readonly pTotalSumSvc: PTotalSumService,

    // ingresos por departamento
    private readonly incDeptSvc: IncomeTypeByDepartmentService,
    private readonly pincDeptSvc: PIncomeTypeByDepartmentService,

    // egresos por departamento
    private readonly spDeptSvc: SpendTypeByDepartmentService,
    private readonly pspDeptSvc: PSpendTypeByDepartmentService,

    // nombres
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
  ) {}

  // =================== CARDS (solo balances; forzamos recálculo) ===================
  async getTotals(params: { fiscalYearId?: number }): Promise<Totals> {
    const fy = params.fiscalYearId;
    if (!Number.isFinite(fy)) {
      this.logger.warn('getTotals sin fiscalYearId válido; devolviendo ceros.');
      return {
        incomes: 0,
        spends: 0,
        balance: 0,
        projectedIncomes: 0,
        projectedSpends: 0,
        projectedBalance: 0,
      };
    }

    // 1) Forzar recálculo de snapshots (Home NO calcula; delega a tus servicios)
    await Promise.allSettled([
      this.totalSumSvc.recalcForFiscalYear(fy!),
      this.pTotalSumSvc.recalcForFiscalYear(fy!),
    ]);

    // 2) Leer snapshots ya actualizados
    const [realSnap, projSnap] = await Promise.all([
      this.totalSumSvc.findByFiscalYear(fy!),
      this.pTotalSumSvc.findByFiscalYear(fy!),
    ]);

    // 3) Tomar valores y hacer SOLO balances
    const incomes = this.num(realSnap?.total_income) ?? this.num((realSnap as any)?.incomeTotal) ?? 0;
    const spends = this.num(realSnap?.total_spend) ?? this.num((realSnap as any)?.spendTotal) ?? 0;

    const projectedIncomes =
      this.num((projSnap as any)?.total_income) ?? this.num((projSnap as any)?.incomeTotal) ?? 0;
    const projectedSpends =
      this.num((projSnap as any)?.total_spend) ?? this.num((projSnap as any)?.spendTotal) ?? 0;

    return {
      incomes,
      spends,
      balance: incomes - spends, // único cálculo
      projectedIncomes,
      projectedSpends,
      projectedBalance: projectedIncomes - projectedSpends, // único cálculo
    };
  }

  // =================== INGRESOS (solo diff) ===================
  async getIncomeComparison(
    params: { fiscalYearId?: number },
    groupByParam?: string,
  ): Promise<ComparisonRow[]> {
    const fy = params.fiscalYearId;
    if (!Number.isFinite(fy)) return [];

    const groupBy = this.normalizeGroupBy(groupByParam);
    if (groupBy !== 'department') return []; // conectamos type/subtype luego

    // 🔁 Home no calcula nada: fuerza refresco en tus servicios y luego lee
    await Promise.allSettled([
      this.incDeptSvc.recalcAllForFiscalYear(fy!),
      this.pincDeptSvc.recalcAllForFiscalYear(fy!),
    ]);

    const [realRows, projRows] = await Promise.all([
      this.incDeptSvc.findByFiscalYear(fy!),
      this.pincDeptSvc.findByFiscalYear(fy!),
    ]);

    const rMap = new Map<number, number>();
    for (const r of realRows ?? []) {
      const id = this.idDept(r);
      rMap.set(id, this.num((r as any).amountDepIncome) ?? 0);
    }

    const pMap = new Map<number, number>();
    for (const p of projRows ?? []) {
      const id = this.idDept(p);
      pMap.set(id, this.num((p as any).amountDepPIncome) ?? 0);
    }

    const ids = Array.from(new Set<number>([...rMap.keys(), ...pMap.keys()]));
    const nameMap = await this.nameByDept(ids);

    // único cálculo permitido aquí: diff
    return ids.map((id) => {
      const real = rMap.get(id) ?? 0;
      const projected = pMap.get(id) ?? 0;
      return { id, name: nameMap.get(id) ?? '', real, projected, diff: real - projected };
    });
  }

  // =================== EGRESOS (solo diff) ===================
  async getSpendComparison(
    params: { fiscalYearId?: number },
    groupByParam?: string,
  ): Promise<ComparisonRow[]> {
    const fy = params.fiscalYearId;
    if (!Number.isFinite(fy)) return [];

    const groupBy = this.normalizeGroupBy(groupByParam);
    if (groupBy !== 'department') return [];

    // Reales por FY (Home no calcula; usa tu servicio y luego lee su snapshot)
    await Promise.allSettled([this.spDeptSvc.recalcAllForFiscalYear(fy!)]);

    const [realRows, projRows] = await Promise.all([
      this.spDeptSvc.findByFiscalYear(fy!),
      // Proyección de egresos por departamento: tu servicio no usa FY, trae todo
      this.pspDeptSvc.findAll(),
    ]);

    const rMap = new Map<number, number>();
    for (const r of realRows ?? []) {
      const id = this.idDept(r);
      rMap.set(id, this.num((r as any).amountDepSpend) ?? 0);
    }

    const pMap = new Map<number, number>();
    for (const p of projRows ?? []) {
      const id = this.idDept(p);
      pMap.set(id, this.num((p as any).amountDepPSpend) ?? 0);
    }

    const ids = Array.from(new Set<number>([...rMap.keys(), ...pMap.keys()]));
    const nameMap = await this.nameByDept(ids);

    return ids.map((id) => {
      const real = rMap.get(id) ?? 0;
      const projected = pMap.get(id) ?? 0;
      return { id, name: nameMap.get(id) ?? '', real, projected, diff: real - projected };
    });
  }

  // =================== helpers ===================
  private normalizeGroupBy(g?: string): GroupBy {
    const v = (g ?? 'department').toLowerCase();
    return (['department', 'type', 'subtype'] as const).includes(v as any)
      ? (v as GroupBy)
      : 'department';
  }

  private idDept(row: any): number {
    return Number(row?.department?.id ?? row?.departmentId ?? row?.id ?? 0);
  }

  private num(v: any): number | undefined {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  private async nameByDept(ids: number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    const rows = await this.deptRepo.find({ where: { id: In(ids) } });
    return new Map(rows.map((d) => [d.id, d.name]));
  }
}
