import { Controller, Get, Query } from '@nestjs/common';
import { HomeService } from './home.service';
import { Totals, ComparisonRow } from './dto/home.dto';

@Controller('home')
export class HomeController {
  constructor(private readonly svc: HomeService) {}

  // Cards superiores
  // GET /home/summary?fiscalYearId=1
  @Get('summary')
  summary(@Query('fiscalYearId') fiscalYearId?: string): Promise<Totals> {
    return this.svc.getTotals({
      fiscalYearId: fiscalYearId ? Number(fiscalYearId) : undefined,
    });
  }

  // Tabla de INGRESOS (por ahora solo groupBy=department)
  // GET /home/incomes?fiscalYearId=1&groupBy=department
  @Get('incomes')
  incomes(
    @Query('fiscalYearId') fiscalYearId?: string,
    @Query('groupBy') groupBy?: string,
  ): Promise<ComparisonRow[]> {
    return this.svc.getIncomeComparison(
      { fiscalYearId: fiscalYearId ? Number(fiscalYearId) : undefined },
      groupBy,
    );
  }

  // Tabla de EGRESOS (por departamento)
  // GET /home/spends?fiscalYearId=1&groupBy=department
  @Get('spends')
  spends(
    @Query('fiscalYearId') fiscalYearId?: string,
    @Query('groupBy') groupBy?: string,
  ): Promise<ComparisonRow[]> {
    return this.svc.getSpendComparison(
      { fiscalYearId: fiscalYearId ? Number(fiscalYearId) : undefined },
      groupBy,
    );
  }
}
