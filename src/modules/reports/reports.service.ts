import type { ReportsRepository } from './reports.repository';
import type { AuthenticatedUser } from '../users/user.types';
import type { ApiError } from '../../utils/api-error';
export const createReportsService=({repository,createApiError}:{repository:ReportsRepository;createApiError:(status:number,message:string)=>ApiError})=>{
  const cents=(value:string)=>{const [whole,fraction='']=value.split('.');return BigInt(whole!)*100n+BigInt(fraction.padEnd(2,'0'));};
  const money=(value:bigint)=>`${value/100n}.${String(value%100n).padStart(2,'0')}`;
  const manage=(actor:AuthenticatedUser)=>{if(actor.role.key!=='supervisor'||actor.role.type!=='system'||!actor.role.permissions.includes('budgets:manage')||actor.role.deniedPermissions.includes('budgets:manage'))throw createApiError(403,'Only supervisors with budgets:manage can change budgets or approval limits.');};
  const summary=async(month:string,currency:string)=>{
      const limit=await repository.limit(currency,undefined,month);
      const [categories,budget,alerts,highExpenses]=await Promise.all([repository.categories(month,currency),repository.budget(month,currency),repository.alerts(month,currency,limit),repository.highExpenses(month,currency,limit)]);
      const spent=categories.reduce((sum,row)=>sum+cents(row.total),0n),allocated=budget===null?null:cents(budget);
      const verdictFor=(amount:bigint)=>allocated===null?'NO BUDGET':amount*100n<=allocated*80n?'ON TRACK':amount<=allocated?'WATCH':'OVER BUDGET';
      const budgetVerdict=verdictFor(spent);
      const tenths=allocated===null?null:(spent*1000n+allocated/2n)/allocated;
      const usage=(amount:bigint)=>{const value=allocated===null?null:(amount*1000n+allocated/2n)/allocated;return value===null?null:`${value/10n}.${value%10n}`;};
      const expenseSubtotal=categories.reduce((sum,row)=>sum+cents(row.expenseSubtotal),0n);
      return {month,currency,categories:categories.map(row=>({...row,percentage:usage(cents(row.total)),budgetVerdict:verdictFor(cents(row.total))})),total:money(spent),expenseSubtotal:money(expenseSubtotal),budget,percentage:tenths===null?null:`${tenths/10n}.${tenths%10n}`,budgetVerdict,
        verdict:highExpenses.length?'NEEDS APPROVAL':budgetVerdict,approvalLimit:limit,pending:alerts,highExpenses};
    };
  return {
    listMonths:async(page:number)=>{const [data,total]=await Promise.all([repository.listMonths((page-1)*25),repository.countMonths()]);return {data,total,page,pageSize:25};},
    getMonth:async(id:string)=>{const record=await repository.findMonth(id);if(!record)throw createApiError(404,'Report month not found.');return {...record,summary:await summary(record.month,record.currency)};},
    createMonths:async(actor:AuthenticatedUser,input:{startMonth:string;endMonth?:string;currency:string;budget:string|null;approvalLimit:string})=>{
      manage(actor);const data=await repository.createMonths(actor.id,input);
      if(!input.endMonth&&!data.length)throw createApiError(409,'This month already exists. Open the existing month to edit it.');
      const index=(month:string)=>Number(month.slice(0,4))*12+Number(month.slice(5,7));
      return {data,created:data.length,skipped:index(input.endMonth??input.startMonth)-index(input.startMonth)+1-data.length};
    },
    updateMonth:async(actor:AuthenticatedUser,id:string,input:{month?:string;budget?:string|null;approvalLimit?:string})=>{
      manage(actor);
      try{const record=await repository.updateMonth(actor.id,id,input);if(!record)throw createApiError(404,'Report month not found.');return record;}
      catch(error){if(typeof error==='object'&&error!==null&&'code'in error&&error.code==='23505')throw createApiError(409,'A report for that month already exists. Choose a different month.');throw error;}
    },
  };
};
export type ReportsService=ReturnType<typeof createReportsService>;
