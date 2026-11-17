import multer from "multer";
import { createHash } from "node:crypto";
import { database } from "../../config/database.module";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { cloudinaryService } from "../cloudinary/cloudinary.module";
import { expenseRepository } from "../expense/expense.module";
import { categoryRepository } from "../category/category.module";
import { createScansRepository } from "./scans.repository";
import { createScansService } from "./scans.service";
import { createScansController } from "./scans.controller";
import { saveScanSchema } from "./scans.schema";
import { receiptReview } from '../ocr/ocr.module';
import { reportsRepository } from '../reports/reports.module';
import { reportSchemas } from '../reports/reports.schema';
const createApiError=(status:number,message:string)=>new ApiError(status,message);
const service=createScansService({database,repository:createScansRepository({database}),expenses:expenseRepository,categories:categoryRepository,
  images:cloudinaryService,review:receiptReview,reports:reportsRepository,fingerprint:(input,image)=>createHash("sha256").update(JSON.stringify(input)).update(image).digest("hex"),logger:console,createApiError});
export const scansController=createScansController({service,schema:saveScanSchema,reviewSchemas:reportSchemas,asyncHandler,createApiError});
export const receiptUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:1,fieldSize:512*1024,parts:2},
  fileFilter:(_req,file,callback)=>{
    if(!new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]).has(file.mimetype))return callback(createApiError(415,"Upload a JPEG, PNG, WebP, HEIC, or HEIF image."));
    callback(null,true);
  },
}).single("image");
