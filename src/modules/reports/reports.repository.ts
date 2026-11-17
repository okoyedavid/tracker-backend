import type { Database,SqlClient } from '../../config/database';
export type ReportMonth={id:string;month:string;currency:string;budget:string|null;approvalLimit:string;createdBy:string;updatedBy:string;createdAt:Date;updatedAt:Date};
const monthColumns=`id,to_char(month,'YYYY-MM') AS month,currency,budget,approval_limit AS "approvalLimit",created_by AS "createdBy",updated_by AS "updatedBy",created_at AS "createdAt",updated_at AS "updatedAt"`;
export const createReportsRepository=({database}:{database:Database})=>({
  ensureMonth:async(client:SqlClient,month:string,actor:string)=>{
    await client.query(`INSERT INTO receipt_tracker.report_months(month,currency,budget,approval_limit,created_by,updated_by)
      VALUES($1::date,'NGN',NULL,COALESCE((SELECT approval_limit FROM receipt_tracker.spending_settings WHERE currency='NGN'),500),$2,$2)
      ON CONFLICT(month) DO NOTHING`,[month+'-01',actor]);
    return (await client.query<ReportMonth>(`SELECT ${monthColumns} FROM receipt_tracker.report_months WHERE month=$1::date FOR KEY SHARE`,[month+'-01'])).rows[0]!;
  },
  limit:async(currency:string|null,client:SqlClient=database,month?:string)=>(await client.query<{limit:string}>(`SELECT COALESCE(
    (SELECT approval_limit FROM receipt_tracker.report_months WHERE currency=$1 AND month=$2::date),
    (SELECT approval_limit FROM receipt_tracker.spending_settings WHERE currency=$1),500.00)::text AS limit`,[currency??'UNSPECIFIED',month?month+'-01':null])).rows[0]!.limit,
  budget:async(month:string,currency:string)=>(await database.query<{amount:string|null}>('SELECT budget AS amount FROM receipt_tracker.report_months WHERE month=$1::date AND currency=$2',[month+'-01',currency])).rows[0]?.amount??null,
  listMonths:async(offset:number)=>(await database.query<ReportMonth & {spent:string}>(`SELECT ${monthColumns},
    COALESCE((SELECT SUM(s.total) FROM receipt_tracker.scans s WHERE s.review_status='approved' AND s.receipt_date>=m.month AND s.receipt_date<m.month+interval '1 month' AND COALESCE(s.currency,'UNSPECIFIED')=m.currency),0)::numeric(30,2)::text AS spent
    FROM receipt_tracker.report_months m ORDER BY m.month DESC,m.currency LIMIT 25 OFFSET $1`,[offset])).rows,
  countMonths:async()=>(await database.query<{count:number}>('SELECT COUNT(*)::integer AS count FROM receipt_tracker.report_months')).rows[0]!.count,
  findMonth:async(id:string)=>(await database.query<ReportMonth>(`SELECT ${monthColumns} FROM receipt_tracker.report_months WHERE id=$1`,[id])).rows[0]??null,
  createMonths:async(actor:string,input:{startMonth:string;endMonth?:string;currency:string;budget:string|null;approvalLimit:string})=>(await database.query<ReportMonth>(`INSERT INTO receipt_tracker.report_months(month,currency,budget,approval_limit,created_by,updated_by)
    SELECT period::date,$3,$4::numeric,$5::numeric,$6::uuid,$6::uuid FROM generate_series($1::date,$2::date,interval '1 month') period
    ON CONFLICT(month) DO NOTHING RETURNING ${monthColumns}`,[input.startMonth+'-01',(input.endMonth??input.startMonth)+'-01',input.currency,input.budget,input.approvalLimit,actor])).rows,
  updateMonth:async(actor:string,id:string,input:{month?:string;budget?:string|null;approvalLimit?:string})=>(await database.query<ReportMonth>(`UPDATE receipt_tracker.report_months SET
    budget=CASE WHEN $3::boolean THEN $4::numeric ELSE budget END,approval_limit=COALESCE($5::numeric,approval_limit),
    month=COALESCE($6::date,month),updated_by=$2,updated_at=now() WHERE id=$1 RETURNING ${monthColumns}`,[id,actor,input.budget!==undefined,input.budget??null,input.approvalLimit??null,input.month?input.month+'-01':null])).rows[0]??null,
  categories:async(month:string,currency:string)=>(await database.query<{categoryId:string;category:string;total:string;scanCount:number;expenseSubtotal:string;expenseCount:number}>(`SELECT c.id AS "categoryId",c.name AS category,SUM(s.total)::text AS total,COUNT(*)::integer AS "scanCount",
    COALESCE(SUM(e.subtotal),0)::numeric(30,2)::text AS "expenseSubtotal",COALESCE(SUM(e.count),0)::integer AS "expenseCount"
    FROM receipt_tracker.scans s JOIN receipt_tracker.categories c ON c.id=s.category_id
    LEFT JOIN (SELECT scan_id,SUM(cost) AS subtotal,COUNT(*) AS count FROM receipt_tracker.expenses WHERE month=$1::date GROUP BY scan_id) e ON e.scan_id=s.id
    WHERE s.review_status='approved' AND s.receipt_date >= $1::date AND s.receipt_date < ($1::date + interval '1 month')
    AND COALESCE(s.currency,'UNSPECIFIED')=$2 GROUP BY c.id,c.name ORDER BY c.name`,[month+'-01',currency])).rows,
  alerts:async(month:string,currency:string,limit:string)=>(await database.query<{id:string;vendor:string;total:string;reasons:string[];imageUrl:string}>(`SELECT s.id,s.vendor,s.total,s.image_url AS "imageUrl",
    s.review_reasons AS reasons FROM receipt_tracker.scans s WHERE s.receipt_date >= $1::date AND s.receipt_date < ($1::date + interval '1 month')
    AND COALESCE(s.currency,'UNSPECIFIED')=$2 AND (s.review_status='pending' OR
      (NOT EXISTS(SELECT 1 FROM receipt_tracker.scan_overrides o WHERE o.scan_id=s.id) AND EXISTS(SELECT 1 FROM receipt_tracker.expenses e WHERE e.scan_id=s.id AND e.cost>$3::numeric)))
    ORDER BY s.created_at,s.id`,[month+'-01',currency,limit])).rows,
  highExpenses:async(month:string,currency:string,limit:string)=>(await database.query<{scanId:string;title:string;cost:string;vendor:string}>(`SELECT s.id AS "scanId",e.title,e.cost,s.vendor FROM receipt_tracker.expenses e JOIN receipt_tracker.scans s ON s.id=e.scan_id
    WHERE s.receipt_date >= $1::date AND s.receipt_date < ($1::date + interval '1 month') AND COALESCE(s.currency,'UNSPECIFIED')=$2
    AND e.cost>$3::numeric AND NOT EXISTS(SELECT 1 FROM receipt_tracker.scan_overrides o WHERE o.scan_id=s.id)
    ORDER BY e.cost DESC,e.id`,[month+'-01',currency,limit])).rows,
});
export type ReportsRepository=ReturnType<typeof createReportsRepository>;
