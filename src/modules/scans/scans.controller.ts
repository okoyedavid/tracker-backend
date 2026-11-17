import type { asyncHandler as AsyncHandler } from "../../utils/async-handler";
import type { ApiError } from "../../utils/api-error";
import type { ScansService } from "./scans.service";
import type { saveScanSchema } from "./scans.schema";
import type { reportSchemas } from '../reports/reports.schema';
export const createScansController=({service,schema,asyncHandler,createApiError,reviewSchemas}:{service:ScansService;schema:typeof saveScanSchema;reviewSchemas:typeof reportSchemas;
  asyncHandler:typeof AsyncHandler;createApiError:(status:number,message:string)=>ApiError;})=>({
  save:asyncHandler(async(req,res)=>{
    if(!req.file?.buffer.length)throw createApiError(400,"A receipt image is required.");
    if(typeof req.body?.payload!=="string")throw createApiError(400,"Receipt payload is required.");
    let payload:unknown;try{payload=JSON.parse(req.body.payload);}catch{throw createApiError(400,"Receipt payload must be JSON.");}
    const result=await service.save(req.user!,schema.parse(payload),req.file.buffer);
    res.status(201).json({data:result,message:result.reviewStatus==='pending'?'Scan submitted for supervisor review.':'Scan and expenses saved.'});
  }),
  pending:asyncHandler(async(req,res)=>{
    const page=req.query.page===undefined?1:Number(req.query.page);
    if(!Number.isInteger(page)||page<1||page>100000||Array.isArray(req.query.page))throw createApiError(400,'Invalid page.');
    res.setHeader('Cache-Control','no-store');res.json({data:await service.pending(req.user!,page),page,pageSize:25});
  }),
  override:asyncHandler(async(req,res)=>{const {id}=reviewSchemas.id.parse(req.params);res.json({data:await service.override(req.user!,id,reviewSchemas.override.parse(req.body)),message:'Supervisor override recorded.'});}),
  list:asyncHandler(async(req,res)=>{
    const page=req.query.page===undefined?1:Number(req.query.page);
    if(!Number.isInteger(page)||page<1||page>100000||Array.isArray(req.query.page))throw createApiError(400,"page must be a positive integer.");
    const [data,total]=await Promise.all([service.list(req.user!,page),service.count(req.user!)]);
    res.setHeader("Cache-Control","no-store");res.json({data,total,page,pageSize:25});
  }),
  get:asyncHandler(async(req,res)=>{
    if(typeof req.params.id!=="string"||!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(req.params.id))throw createApiError(400,"Invalid scan ID.");
    res.setHeader("Cache-Control","no-store");res.json({data:await service.get(req.user!,req.params.id)});
  }),
});
