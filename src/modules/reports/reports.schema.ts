import { z } from 'zod';
const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(value=>Number(value.slice(0,4))>=2000&&Number(value.slice(0,4))<=9999,'Use a month between 2000 and 9999.');
const currency=z.literal('NGN').default('NGN');
const money=z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/);
const positiveMoney=money.refine(value=>Number(value)>0,'Budget must be greater than zero.');
const monthIndex=(value:string)=>Number(value.slice(0,4))*12+Number(value.slice(5,7))-1;
export const reportSchemas={
  months:z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict(),
  createMonths:z.object({startMonth:month,endMonth:month.optional(),currency,budget:positiveMoney.nullable().default(null),approvalLimit:money.default('500.00')}).strict()
    .refine(value=>{const length=monthIndex(value.endMonth??value.startMonth)-monthIndex(value.startMonth)+1;return length>=1&&length<=120;},'Choose an inclusive range of 1–120 months.'),
  updateMonth:z.object({month:month.optional(),budget:positiveMoney.nullable().optional(),approvalLimit:money.optional()}).strict().refine(value=>Object.keys(value).length>0,'Provide a month, budget or approval limit.'),
  override:z.object({reason:z.string().trim().min(5).max(1000),total:money.refine(value=>Number(value)>0,'Confirm a total greater than zero.')}).strict(),
  id:z.object({id:z.string().uuid()}),
};
