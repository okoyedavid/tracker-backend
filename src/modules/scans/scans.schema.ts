import { z } from "zod";
import { ocrResponseSchema,receiptResponseSchema } from "../ocr/ocr.schema";
const money=z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/,"Use a non-negative amount with at most two decimal places.");
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
  const parsed=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
},"Use a valid YYYY-MM-DD date.");
export const saveScanSchema=z.object({
  reviewToken:z.string().min(1).max(4000),overrideReason:z.string().trim().min(5).max(1000).optional(),
  requestId:z.string().uuid(),categoryId:z.string().uuid(),vendor:z.string().trim().min(1).max(200),date,
  total:money.refine(value=>Number(value)>0,'Confirm a total greater than zero.'),tax:money.nullable().default(null),discount:money.nullable().default(null),currency:z.literal('NGN').default('NGN'),
  response:receiptResponseSchema,
  reviewedOcr:ocrResponseSchema,
  expenses:z.array(z.object({title:z.string().trim().min(1).max(200),cost:money,date:date.optional(),
    sourceLineIndexes:z.array(z.number().int().nonnegative()).max(100).default([])}).strict()).min(1).max(200),
}).strict().refine(value=>value.expenses.every(item=>item.sourceLineIndexes.every(index=>index<value.response.ocr.lines.length)),{
  message:"Expense source lines must refer to the original OCR transcript.",path:["expenses"],
}).transform(value=>({...value,expenses:value.expenses.map(item=>({...item,date:value.date}))}));
export type SaveScanInput=z.infer<typeof saveScanSchema>;
