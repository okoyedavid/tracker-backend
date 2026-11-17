import type { ReportsService } from './reports.service';
import type { reportSchemas } from './reports.schema';
import type { asyncHandler as AsyncHandler } from '../../utils/async-handler';
export const createReportsController=({service,schemas,asyncHandler}:{service:ReportsService;schemas:typeof reportSchemas;asyncHandler:typeof AsyncHandler})=>({
  months:asyncHandler(async(req,res)=>{const {page}=schemas.months.parse(req.query);res.setHeader('Cache-Control','no-store');res.json(await service.listMonths(page));}),
  month:asyncHandler(async(req,res)=>{const {id}=schemas.id.parse(req.params);res.setHeader('Cache-Control','no-store');res.json({data:await service.getMonth(id)});}),
  createMonths:asyncHandler(async(req,res)=>{const result=await service.createMonths(req.user!,schemas.createMonths.parse(req.body));res.status(result.created?201:200).json(result);}),
  updateMonth:asyncHandler(async(req,res)=>{const {id}=schemas.id.parse(req.params);res.json({data:await service.updateMonth(req.user!,id,schemas.updateMonth.parse(req.body))});}),
});
