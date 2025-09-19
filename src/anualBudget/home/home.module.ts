import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HomeController } from './home.controller';
import { HomeService } from './home.service';

import { TotalSumModule } from '../totalSum/total-sum.module';
import { PTotalSumModule } from '../pTotalSum/p-total-sum.module';

import { IncomeTypeByDepartmentModule } from '../incomeTypeByDeparment/income-type-by-department.module';
import { PIncomeTypeByDepartmentModule } from '../pIncomeTypeByDeparment/p-income-type-by-department.module';

// IMPORTA TAMBIÉN EL MÓDULO DE EGRESOS REALES
import { SpendTypeByDepartmentModule } from '../spendTypeByDepartment/spend-type-by-department.module';
import { PSpendTypeByDepartmentModule } from '../pSpendTypeByDepartment/p-spend-type-by-department.module';

import { Department } from '../department/entities/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Department]),

    TotalSumModule,
    PTotalSumModule,

    IncomeTypeByDepartmentModule,
    PIncomeTypeByDepartmentModule,

    SpendTypeByDepartmentModule,
    PSpendTypeByDepartmentModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}
