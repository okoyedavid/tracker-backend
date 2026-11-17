import type { Database } from "../../config/database";
import type { ApiError } from "../../utils/api-error";
import type { ScansRepository,SavedScan } from "./scans.repository";
import type { SaveScanInput } from "./scans.schema";
import type { CloudinaryService } from "../cloudinary/cloudinary.service";
import type { ExpenseRepository } from "../expense/expense.repository";
import type { CategoryRepository } from "../category/category.repository";
import type { AuthenticatedUser } from "../users/user.types";
import type { ReceiptReview } from '../ocr/receipt-review';
import type { ReportsRepository } from '../reports/reports.repository';
export const createScansService=({database,repository,expenses,categories,images,fingerprint,logger,createApiError,review,reports}:{
  database:Database;repository:ScansRepository;expenses:ExpenseRepository;categories:CategoryRepository;images:CloudinaryService;
  fingerprint:(input:SaveScanInput,image:Buffer)=>string;logger:Pick<Console,"error">;createApiError:(status:number,message:string)=>ApiError;
  review:ReceiptReview;reports:ReportsRepository;
})=>{
  const publicScan=({requestHash:_hash,...scan}:SavedScan)=>scan;
  const sameRequest=(saved:SavedScan,hash:string)=>{
    if(saved.requestHash!==hash)throw createApiError(409,"This confirmation was already saved with different details. Open the saved scan instead of saving it again.");
    return publicScan(saved);
  };
  const canViewAll=(actor:AuthenticatedUser)=>actor.role.permissions.includes("expenses:view")&&!actor.role.deniedPermissions.includes("expenses:view");
  const cents=(value:string)=>{const [whole,fraction=""]=value.split(".");return BigInt(whole!)*100n+BigInt(fraction.padEnd(2,"0"));};
  const requireApprover=(actor:AuthenticatedUser)=>{
    if(actor.role.type!=='system'||actor.role.key!=='supervisor'||actor.role.status!=='active'||!actor.role.permissions.includes('expenses:approve')||actor.role.deniedPermissions.includes('expenses:approve'))throw createApiError(403,'Only supervisors with expenses:approve can override receipt review.');
  };
  const amountReasons=(items:{title:string;cost:string}[],limit:string)=>items.filter(item=>cents(item.cost)>cents(limit)).map(item=>`${item.title} ${item.cost} is above the ${limit} approval limit.`);
  const save=async(actor:AuthenticatedUser,input:SaveScanInput,image:Buffer)=>{
    const hash=fingerprint(input,image);
    const existing=await repository.findRequest(actor.id,input.requestId);
    if(existing)return sameRequest(existing,hash);
    const quality=review.verify(actor.id,image,input.response,input.reviewToken);
    const unread=quality.unreadLineIndexes.filter(index=>!input.reviewedOcr.lines[index]?.text.trim()||input.reviewedOcr.lines[index]?.text===input.response.ocr.lines[index]?.text);
    const reasons=[...(unread.length?[`OCR lines ${unread.map(index=>index+1).join(', ')} are unread (confidence below 60% or unavailable).`]:[]),...(quality.missingTotal?['The original OCR could not read the total.']:[])];
    if(input.overrideReason)requireApprover(actor);
    if(!await categories.find(input.categoryId))throw createApiError(400,"Choose an existing category.");
    const uploaded=await images.uploadImage(image,actor.id);
    let saved:SavedScan;
    try {
      saved=await database.transaction(async client=>{
        await repository.lockRequest(client,actor.id,input.requestId);
        const duplicate=await repository.findRequest(actor.id,input.requestId,client);
        if(duplicate){sameRequest(duplicate,hash);return duplicate;}
        const month=await reports.ensureMonth(client,input.date.slice(0,7),actor.id);
        const allReasons=[...reasons,...amountReasons(input.expenses,month.approvalLimit)];
        const sum=input.expenses.reduce((total,item)=>total+cents(item.cost),0n);
        const reconciled=sum+(input.tax===null?0n:cents(input.tax))-(input.discount===null?0n:cents(input.discount))===cents(input.total);
        const id=await repository.insert(client,actor.id,input,hash,uploaded,reconciled,allReasons,!allReasons.length||!!input.overrideReason);
        await expenses.createMany(client,id,input.expenses);
        if(input.overrideReason)await repository.recordOverride(client,id,actor.id,input.overrideReason,input.total,input.total,allReasons);
        return (await repository.findRequest(actor.id,input.requestId,client))!;
      });
    } catch(error) {
      try {await images.deleteImage(uploaded.publicId);}catch{logger.error("Receipt image cleanup failed after a save error.");}
      throw error;
    }
    if(saved.imagePublicId!==uploaded.publicId){try{await images.deleteImage(uploaded.publicId);}catch{logger.error("Duplicate receipt image cleanup failed.");}}
    return publicScan(saved);
  };
  return {save,
    pending:async(actor:AuthenticatedUser,page:number)=>{requireApprover(actor);return (await repository.pending((page-1)*25)).map(publicScan);},
    override:async(actor:AuthenticatedUser,id:string,input:{reason:string;total:string})=>{
      requireApprover(actor);
      return database.transaction(async client=>{
        const scan=await repository.lock(client,id);
        if(!scan)throw createApiError(404,'Scan not found.');
        if(scan.override)throw createApiError(409,'This scan has already been approved.');
        const reasons=[...scan.reviewReasons,...amountReasons(scan.expenses,await reports.limit(scan.currency,client,scan.date.slice(0,7)))];
        if(scan.reviewStatus!=='pending'&&!reasons.length)throw createApiError(409,'This scan does not require an override.');
        await repository.recordOverride(client,id,actor.id,input.reason,scan.total,input.total,[...new Set(reasons)]);
        return publicScan((await repository.lock(client,id))!);
      });
    },
    list:async(actor:AuthenticatedUser,page:number)=>(await repository.list(actor.id,canViewAll(actor),(page-1)*25)).map(publicScan),
    count:async(actor:AuthenticatedUser)=>repository.count(actor.id,canViewAll(actor)),
    get:async(actor:AuthenticatedUser,id:string)=>{const scan=await repository.get(id,actor.id,canViewAll(actor));if(!scan)throw createApiError(404,"Scan not found.");
      const reasons=scan.override?scan.reviewReasons:[...new Set([...scan.reviewReasons,...amountReasons(scan.expenses,await reports.limit(scan.currency,undefined,scan.date.slice(0,7)))])];
      return publicScan({...scan,reviewReasons:reasons});},
  };
};
export type ScansService=ReturnType<typeof createScansService>;
