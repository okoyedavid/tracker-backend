import type { SqlClient } from "../../config/database";
export type ExpenseInput={ title:string; cost:string; date:string; sourceLineIndexes:number[] };
export type ExpenseRecord=ExpenseInput & {id:string;scanId:string;month:string};
export const createExpenseRepository=()=>({
  createMany:async(client:SqlClient,scanId:string,items:ExpenseInput[])=>{
    const result=await client.query<ExpenseRecord>(`INSERT INTO receipt_tracker.expenses(scan_id,title,cost,expense_date,position,source_line_indexes)
      SELECT $1,item->>'title',(item->>'cost')::numeric,(item->>'date')::date,ordinality-1,
        ARRAY(SELECT jsonb_array_elements_text(item->'sourceLineIndexes'))::integer[]
      FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS input(item,ordinality)
      RETURNING id,scan_id AS "scanId",title,cost,expense_date::text AS date,to_char(month,'YYYY-MM') AS month,source_line_indexes AS "sourceLineIndexes"`,[scanId,JSON.stringify(items)]);
    return result.rows;
  },
});
export type ExpenseRepository=ReturnType<typeof createExpenseRepository>;
