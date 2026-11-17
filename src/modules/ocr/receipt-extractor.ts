import type { OcrLine, OcrResponse, ExpenseCandidate } from "./ocr.types";

const supplierLabel = /^(?:supplier|vendor|merchant|payee|issued by|sold by|from)(?:\s*[:\uFF1A-]\s*(.*)|\s*)$/i;
const recipientLabel = /^(?:bill(?:ed)? to|ship(?:ped)? to|sold to|customer|buyer|recipient)\b/i;
const documentBoundary = /^(?:description|item(?:s)?|qty|quantity|product|service|sub\s*total|total|amount|payment|balance)\b/i;

function isVendorName(text: string): boolean {
  // Prices, contact details, addresses and document metadata are not merchants.
  return text.length >= 3 && text.length <= 100 &&
    (text.match(/\p{L}/gu) ?? []).length >= 3 &&
    !/\d+[.,]\d{2}\b|https?:|www\.|@|\d[\d /():-]{4,}/i.test(text) &&
    !/^(?:receipt|invoice|tax invoice|date|tel(?:ephone)?|phone|email|address|cashier|order|reference|thank you|welcome)\b/i.test(text) &&
    !/^\d+\s+/.test(text) &&
    !supplierLabel.test(text) && !recipientLabel.test(text) && !documentBoundary.test(text);
}

function extractVendor(lines: OcrLine[]): string | null {
  // Explicit issuer labels take precedence, regardless of industry or brand.
  for (const [index, line] of lines.entries()) {
    const match = supplierLabel.exec(line.text.trim());
    if (!match) continue;
    const name = match[1]?.trim() || lines[index + 1]?.text.trim() || "";
    if (isVendorName(name)) return name;
  }

  // Only consider the header before customer details or the item table.
  // Never search the footer or product descriptions for a familiar brand.
  for (const line of lines.slice(0, 8)) {
    const text = line.text.trim();
    if (recipientLabel.test(text) || documentBoundary.test(text)) break;
    if (isVendorName(text)) return text;
  }
  return null;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function extractDate(text: string): string | null {
  const patterns = [
    /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g,
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g,
    /\b(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{4}|\d{2})\b/g,
    /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/g,
  ];
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  for (const [kind, pattern] of patterns.entries()) {
    for (const match of text.matchAll(pattern)) {
      const [, a = "", b = "", c = ""] = match;
      let date: string | null;
      if (kind === 0) date = isoDate(+a, +b, +c);
      // Default DMY; use MDY only when the second number cannot be a month.
      else if (kind === 1)
        date = +b > 12 ? isoDate(+c, +a, +b) : isoDate(+c, +b, +a);
      else if (kind === 2)
        date = months.includes(b.slice(0, 3).toLowerCase())
          ? isoDate(+c, months.indexOf(b.slice(0, 3).toLowerCase()) + 1, +a)
          : null;
      else
        date = months.includes(a.slice(0, 3).toLowerCase())
          ? isoDate(+c, months.indexOf(a.slice(0, 3).toLowerCase()) + 1, +b)
          : null;
      if (date) return date;
    }
  }
  return null;
}

// Parse an entire amount field, never a numeric substring of a date, ID or label.
function parseAmount(text: string): number | null {
  const match = /^\s*(?:NGN|USD|GBP|EUR|CAD|AUD|\u20A6|\$|\u00A3|\u20AC)?\s*(-?(?:\d[\d.,]*))\s*(?:NGN|USD|GBP|EUR|CAD|AUD)?\s*$/i.exec(text);
  if (!match) return null;
  const token = match[1]!;
  let normalized: string;
  if (/^-?\d+$/.test(token)) normalized = token;
  else if (/^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?$/.test(token))
    normalized = token.replace(/,/g, "");
  else if (/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?$/.test(token))
    normalized = token.replace(/\./g, "").replace(",", ".");
  else return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && Math.abs(amount) <= Number.MAX_SAFE_INTEGER / 100 ? amount : null;
}

export function extractTotal(lines: OcrLine[]): number | null {
  const ranked: { amount: number; rank: number }[] = [];
  for (const [index, line] of lines.entries()) {
    // Anchoring the complete label keeps discounts, taxes, item counts and
    // cash tendered from being interpreted as the receipt's total.
    const match = /^(grand\s+total|total\s+due|amount\s+due|total(?:\s+(?:cash|amount))?|cash\s+total)\b\s*[:\uFF1A=\u2013]?\s*(.*)$/i.exec(line.text.trim());
    if (!match) continue;
    const remainder = match[2]?.trim() ?? "";
    const amount = parseAmount(remainder || (lines[index + 1]?.text ?? ""));
    if (amount !== null) ranked.push({
      amount,
      rank: /^(?:grand|total\s+due|amount\s+due)/i.test(match[1]!) ? 2 : 1,
    });
  }
  const explicit = ranked.reverse().sort((a, b) => b.rank - a.rank)[0];
  // Without an explicit total, the largest number might be a unit price,
  // transfer reference or cash tendered. Leave the field for user review.
  return explicit?.amount ?? null;
}

export const createReceiptExtractor = () => {
  const extractExpenses = (ocr:OcrResponse) => {
    const adjustment=(label:RegExp)=>{
      for(const [index,line] of ocr.lines.entries()){
        const match=label.exec(line.text.trim());
        if(match){const amount=parseAmount(match[1]?.trim() || ocr.lines[index+1]?.text || "");if(amount!==null&&amount>=0)return amount;}
      }
      return null;
    };
    const adjustments=ocr.adjustments??{tax:adjustment(/^(?:tax|vat|sales tax)\s*[:=-]?\s*(.*)$/i),discount:adjustment(/^(?:discount|discount total)\s*[:=-]?\s*(.*)$/i),currency:null};
    if(ocr.expenses!==undefined)return {expenses:ocr.expenses,adjustments};
    // Paddle stays local: use geometric rows when available, otherwise the explicit item table.
    const rows=ocr.lines.map((line,index)=>({text:line.text.trim(),indexes:[index],x:line.boundingBox?.length?Math.min(...line.boundingBox.map(point=>point[0])):0,
      y:line.boundingBox?.length?line.boundingBox.reduce((sum,point)=>sum+point[1],0)/line.boundingBox.length:null,
      height:line.boundingBox?.length?Math.max(...line.boundingBox.map(point=>point[1]))-Math.min(...line.boundingBox.map(point=>point[1])):0}));
    if(rows.length&&rows.every(row=>row.y!==null)){
      rows.sort((a,b)=>a.y!-b.y! || a.x-b.x);
      const grouped:typeof rows=[];
      for(const row of rows){const previous=grouped.at(-1);
        if(previous&&Math.abs(previous.y!-row.y!)<=Math.max(2,Math.min(previous.height,row.height)*0.55)){
          const parts=[previous,row].sort((a,b)=>a.x-b.x);previous.text=parts.map(part=>part.text).join(" ");previous.indexes=parts.flatMap(part=>part.indexes);previous.x=Math.min(previous.x,row.x);
        }else grouped.push({...row});
      }
      rows.splice(0,rows.length,...grouped);
    }
    const start=rows.findIndex(row=>/^(?:description|item(?:s)?|product(?:s)?|services?)\b/i.test(row.text));
    const expenses:ExpenseCandidate[]=[];
    if(start<0)return {expenses,adjustments};
    const headings=rows.slice(start,start+5).map(row=>row.text).join(" ");
    const expectedColumns=/\b(?:qty|quantity)\b/i.test(headings)?/sub\s*total/i.test(headings)?3:2:1;
    let title="",indexes:number[]=[],amounts:number[]=[];
    const flush=()=>{
      if(title&&amounts.length)expenses.push({title:title.slice(0,200),cost:amounts.length>=expectedColumns?amounts.at(-1)!:null,sourceLineIndexes:[...new Set(indexes)]});
      title="";indexes=[];amounts=[];
    };
    for(const row of rows.slice(start+1)){
      if(/^(?:tax|vat|discount|grand\s+total|total|amount\s+due|payment|terms?|balance|thank)\b/i.test(row.text) || (/^sub\s*total\b/i.test(row.text)&&/\d/.test(row.text))){flush();break;}
      if(/^(?:description|qty|quantity|price|unit\s*price|sub\s*total|amount|cost)(?:\s+(?:qty|quantity|price|subtotal|amount|cost))*$/i.test(row.text))continue;
      if(!row.text)continue;
      if(!/\p{L}/u.test(row.text)||parseAmount(row.text)!==null){
        if(title){const values=row.text.split(/\s+/).map(parseAmount).filter((value):value is number=>value!==null&&value>=0);amounts.push(...values);indexes.push(...row.indexes);}
        continue;
      }
      const match=/^(.*?)\s+((?:(?:[$£€₦]|NGN|USD|GBP|EUR)?\s*\d[\d.,]*\s*)+)$/.exec(row.text);
      if(amounts.length)flush();
      if(match){
        const values=match[2]!.trim().split(/\s+/).map(parseAmount).filter((value):value is number=>value!==null&&value>=0);
        title=[title,match[1]!.trim()].filter(Boolean).join(" ");amounts.push(...values);indexes.push(...row.indexes);flush();
      }else{title=[title,row.text].filter(Boolean).join(" ");indexes.push(...row.indexes);}
      if(expenses.length>=200)break;
    }
    flush();
    return {expenses,adjustments};
  };
  const extractReceipt = (ocr: OcrResponse) => {
    const lines = ocr.lines.length
      ? ocr.lines
      : ocr.text
          .split(/\r?\n/)
          .filter((text) => text.trim())
          .map((text) => ({ text, confidencePercentage: null }));
    return {
      vendor: extractVendor(lines),
      date: extractDate(ocr.text),
      total: extractTotal(lines),
    };
  };

  return { extractReceipt, extractExpenses };
};
