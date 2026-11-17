import type { Database,SqlClient } from "../../config/database";
import type { SaveScanInput } from "./scans.schema";
import type { ExpenseRecord } from "../expense/expense.repository";
export type SavedScan={id:string;createdBy:string;categoryId:string;vendor:string;date:string;total:string;tax:string|null;discount:string|null;
  currency:string|null;imageUrl:string;imagePublicId:string;reconciled:boolean;createdAt:Date;requestHash:string;expenses:ExpenseRecord[];
  categoryName:string;createdByName:string;reportMonthId:string|null;
  reviewStatus:'approved'|'pending';reviewReasons:string[];override:{approvedBy:string;reason:string;createdAt:string;originalTotal:string;confirmedTotal:string}|null};
const select=`SELECT s.id,s.created_by AS "createdBy",s.category_id AS "categoryId",s.vendor,s.receipt_date::text AS date,
  s.total,s.tax,s.discount,s.currency,s.image_url AS "imageUrl",s.image_public_id AS "imagePublicId",s.reconciled,
  s.created_at AS "createdAt",s.request_hash AS "requestHash",s.review_status AS "reviewStatus",s.review_reasons AS "reviewReasons",
  (SELECT c.name FROM receipt_tracker.categories c WHERE c.id=s.category_id) AS "categoryName",
  (SELECT u.name FROM receipt_tracker.users u WHERE u.id=s.created_by) AS "createdByName",
  (SELECT m.id FROM receipt_tracker.report_months m WHERE m.month=date_trunc('month',s.receipt_date)::date) AS "reportMonthId",
  (SELECT json_build_object('approvedBy',o.approved_by,'reason',o.reason,'createdAt',o.created_at,'originalTotal',o.original_total::text,'confirmedTotal',o.confirmed_total::text) FROM receipt_tracker.scan_overrides o WHERE o.scan_id=s.id) AS override,
  COALESCE((SELECT json_agg(json_build_object('id',e.id,'scanId',e.scan_id,'title',e.title,'cost',e.cost::text,
    'date',e.expense_date::text,'month',to_char(e.month,'YYYY-MM'),'sourceLineIndexes',e.source_line_indexes) ORDER BY e.position) FROM receipt_tracker.expenses e WHERE e.scan_id=s.id),'[]') AS expenses
  FROM receipt_tracker.scans s`;
const monthLimit=`COALESCE((SELECT m.approval_limit FROM receipt_tracker.report_months m WHERE m.month=date_trunc('month',s.receipt_date)::date AND m.currency=COALESCE(s.currency,'UNSPECIFIED')),
  (SELECT settings.approval_limit FROM receipt_tracker.spending_settings settings WHERE settings.currency=s.currency),500)`;
export const createScansRepository=({database}:{database:Database})=>({
  findRequest:async(owner:string,requestId:string,client:SqlClient=database)=>(await client.query<SavedScan>(`${select} WHERE s.created_by=$1 AND s.request_id=$2`,[owner,requestId])).rows[0]??null,
  lockRequest:async(client:SqlClient,owner:string,requestId:string)=>{await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${owner}:${requestId}`]);},
  insert:async(client:SqlClient,owner:string,input:SaveScanInput,hash:string,image:{url:string;publicId:string},reconciled:boolean,reasons:string[],approved:boolean)=>{
    const result=await client.query<{id:string}>(`INSERT INTO receipt_tracker.scans(created_by,category_id,request_id,request_hash,vendor,
      receipt_date,total,tax,discount,currency,response,reviewed_ocr,image_url,image_public_id,reconciled,review_status,review_reasons)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17::jsonb) RETURNING id`,
      [owner,input.categoryId,input.requestId,hash,input.vendor,input.date,input.total,input.tax,input.discount,input.currency,
        JSON.stringify(input.response),JSON.stringify(input.reviewedOcr),image.url,image.publicId,reconciled,approved?'approved':'pending',JSON.stringify(reasons)]);
    return result.rows[0]!.id;
  },
  list:async(owner:string,all:boolean,offset:number)=>(await database.query<SavedScan>(`${select} WHERE ($2::boolean OR s.created_by=$1) ORDER BY s.created_at DESC,s.id LIMIT 25 OFFSET $3`,[owner,all,offset])).rows,
  count:async(owner:string,all:boolean)=>(await database.query<{count:number}>('SELECT COUNT(*)::integer AS count FROM receipt_tracker.scans WHERE ($2::boolean OR created_by=$1)',[owner,all])).rows[0]!.count,
  get:async(id:string,owner:string,all:boolean)=>(await database.query<SavedScan & {response:unknown;reviewedOcr:unknown}>(`${select.replace("SELECT s.id,","SELECT s.response,s.reviewed_ocr AS \"reviewedOcr\",s.id,")} WHERE s.id=$1 AND ($3::boolean OR s.created_by=$2)`,[id,owner,all])).rows[0]??null,
  pending:async(offset:number)=>(await database.query<SavedScan>(`${select.replace('s.review_reasons AS "reviewReasons"',`s.review_reasons || COALESCE((SELECT jsonb_agg(e.title || ' ' || e.cost::text || ' is above the ' || (${monthLimit})::text || ' approval limit.') FROM receipt_tracker.expenses e WHERE e.scan_id=s.id AND e.cost>${monthLimit}),'[]'::jsonb) AS "reviewReasons"`)}
    WHERE s.review_status='pending' OR (NOT EXISTS(SELECT 1 FROM receipt_tracker.scan_overrides o WHERE o.scan_id=s.id) AND EXISTS(SELECT 1 FROM receipt_tracker.expenses e WHERE e.scan_id=s.id AND e.cost>${monthLimit}))
    ORDER BY s.created_at,s.id LIMIT 25 OFFSET $1`,[offset])).rows,
  lock:async(client:SqlClient,id:string)=>{await client.query('SELECT id FROM receipt_tracker.scans WHERE id=$1 FOR UPDATE',[id]);return (await client.query<SavedScan>(`${select} WHERE s.id=$1`,[id])).rows[0]??null;},
  recordOverride:async(client:SqlClient,id:string,actor:string,reason:string,originalTotal:string,total:string,reasons:string[])=>{
    await client.query(`INSERT INTO receipt_tracker.scan_overrides(scan_id,approved_by,reason,original_total,confirmed_total,review_reasons) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[id,actor,reason,originalTotal,total,JSON.stringify(reasons)]);
    await client.query(`UPDATE receipt_tracker.scans s SET review_status='approved',total=$2,
      reconciled=(COALESCE((SELECT SUM(e.cost) FROM receipt_tracker.expenses e WHERE e.scan_id=s.id),0)+COALESCE(s.tax,0)-COALESCE(s.discount,0)=$2::numeric) WHERE s.id=$1`,[id,total]);
  },
});
export type ScansRepository=ReturnType<typeof createScansRepository>;
