import type { ReceiptResponse } from './ocr.types';
import type { ApiError } from '../../utils/api-error';
type Claims={userId:string;imageHash:string;responseHash:string;version?:2};
type ReviewResponse=Pick<ReceiptResponse,'fields'|'ocr'> & Partial<Pick<ReceiptResponse,'expenses'|'adjustments'|'needsReview'>>;
export const createReceiptReview=({hash,sign,verify,normalize,createApiError}:{hash:(input:string|Buffer)=>string;sign:(claims:Claims)=>string;verify:(token:string)=>Claims;normalize:(response:ReviewResponse)=>ReviewResponse;createApiError:(status:number,message:string)=>ApiError})=>{
  const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value!==null&&typeof value==='object'
    ?Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])):value;
  const digest=(response:ReviewResponse)=>hash(JSON.stringify(canonical({ocr:response.ocr,fields:response.fields,expenses:response.expenses,adjustments:response.adjustments})));
  // Previously issued tokens expire within 24 hours. Preserve those drafts across this format upgrade.
  const legacyDigest=(response:ReviewResponse)=>hash(JSON.stringify({fields:{vendor:response.fields.vendor,date:response.fields.date,total:response.fields.total},
    lines:response.ocr.lines.map(line=>({text:line.text,confidence:line.confidencePercentage}))}));
  const assess=(response:ReviewResponse)=>({threshold:60,unreadLineIndexes:response.ocr.lines.flatMap((line,index)=>line.confidencePercentage===null||line.confidencePercentage<60?[index]:[]),missingTotal:response.fields.total===null||response.fields.total<=0});
  return {
    issue:(userId:string,image:Buffer,response:ReviewResponse)=>({reviewToken:sign({version:2,userId,imageHash:hash(image),responseHash:digest(normalize(response))}),quality:assess(response)}),
    verify:(userId:string,image:Buffer,response:ReviewResponse,token:string)=>{
      const claims=verify(token);
      if(claims.userId!==userId)throw createApiError(400,'This receipt was scanned under a different account. Scan it while signed into this account.');
      if(claims.imageHash!==hash(image))throw createApiError(400,'The selected image differs from the scanned image. Select the original image or read this image again.');
      const matches=claims.version===2?claims.responseHash===digest(normalize(response)):
        claims.version===undefined&&(claims.responseHash===digest(response)||claims.responseHash===legacyDigest(response));
      if(!matches)throw createApiError(400,'The original OCR snapshot changed. Edit the review fields instead of the original transcript, or read the image again.');
      return assess(response);
    },
  };
};
export type ReceiptReview=ReturnType<typeof createReceiptReview>;
