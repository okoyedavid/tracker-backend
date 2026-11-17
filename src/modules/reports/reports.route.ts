import { Router } from 'express';
import { protect,sameOrigin,requirePermission } from '../../middleware/security.module';
import { reportsController } from './reports.module';
export const reportsRouter=Router();
reportsRouter.use(sameOrigin,protect);
reportsRouter.get('/months',requirePermission('reports:view'),reportsController.months);
reportsRouter.post('/months',requirePermission('budgets:manage'),reportsController.createMonths);
reportsRouter.get('/months/:id',requirePermission('reports:view'),reportsController.month);
reportsRouter.patch('/months/:id',requirePermission('budgets:manage'),reportsController.updateMonth);
