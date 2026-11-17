# Receipt Tracker Backend

A business expense API that extracts the supplier/payee, date and total from receipt text across business spending, including supplies, equipment, logistics, utilities, software and meals.

## Development

```env
PORT=5000
PADDLE_SERVER=http://127.0.0.1:8000/ocr
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.5-flash-lite
OCR_REQUEST_TIMEOUT_MS=25000
```

Run `npm install`, then `npm run dev`. Start the external Python OCR API separately using its own instructions. This repository contains only the HTTP client, not a native OCR installation.

Authentication uses PostgreSQL. Configure the variables in `.env.example`, run `npm run db:migrate`, and follow [authentication setup and frontend contract](AUTH.md). `DATABASE_URL` and `DATABASE_URL_POOLED` must be valid PostgreSQL URLs when supplied. `PORT` must be an integer from 1 to 65535.

## API

Receipt review now includes a shared category and editable expense rows. Confirmation uploads the image to Cloudinary and saves the scan and expenses. See [receipt API and persistence contract](RECEIPTS.md).

1. `POST /api/ocr` requires authentication and `receipts:scan` permission. It accepts raw image bytes with an image Content-Type and optional `x-filename` header (10 MB maximum).
2. OCR calls the selected provider. Paddle receives multipart field `file`; its `confidence` values become `confidencePercentage` without rescaling. Gemini estimates `confidencePercentage` separately for every line and includes `confidenceSource: "model_estimate"`. These are subjective self-assessments, not calibrated probabilities or directly comparable Paddle scores. Missing or out-of-range Gemini scores fail validation with 502. The response `ocr.model` identifies the engine/model used.
3. In the same request, the controller calls `ocrService.processReceipt` to validate the transcript and extract vendor/date/total. It returns `{ocr, fields: {vendor, date, total}, needsReview: true}`. Fields may be null; the existing extractor is reused. No second request is needed.

Example successful response:

```json
{
  "ocr": {
    "text": "RIVERDALE MARKET\n04/26/2025\nTotal $17.75",
    "model": "PaddleOCR",
    "lines": [
      { "text": "RIVERDALE MARKET", "confidencePercentage": 98.94 },
      { "text": "04/26/2025", "confidencePercentage": 99.0 },
      { "text": "Total $17.75", "confidencePercentage": 98.0 }
    ]
  },
  "fields": { "vendor": "RIVERDALE MARKET", "date": "2025-04-26", "total": 17.75 },
  "needsReview": true
}
```

The former `/api/scan` endpoint has been removed. Update clients to read recognized text from `response.ocr` and review values from `response.fields` directly after the image upload. This is an API contract change; raw OCR data is now nested under `ocr`.

Select the provider per request:

| Request | Provider |
| --- | --- |
| `POST /api/ocr` | Gemini (default) |
| `POST /api/ocr?model=gemini` | Gemini |
| `POST /api/ocr?model=paddle` | Paddle |

`model` accepts only `gemini` or `paddle`. Empty, repeated, or unknown values return 400. The parameter selects the provider; configure the underlying Gemini model using `GEMINI_MODEL` and `GEMINI_ALLOWED_MODELS` on the backend. Each request is independent. There is no automatic fallback: a missing key, inaccessible provider, quota error, or timeout is returned to the caller.

```ts
const response = await fetch(`/api/ocr?${new URLSearchParams({ model: "paddle" })}`, {
  method: "POST",
  headers: { "Content-Type": file.type, "x-filename": file.name },
  body: file,
});
```

Both provider modules are internal services with no controllers or routes. Credentials stay server-side.

The Paddle module contains its service, schema, and composition module. The OCR service handles provider dispatch and receipt processing. Field extraction runs locally without another provider call or database write.

## Timeouts and validation

The Node deadline remains 25 seconds, below the frontend proxy's 30-second timeout. The first direct Paddle test took 53.3 seconds for `images/receipt.jpg`, so a cold or slow scan can return 504. A timeout does not stop inference inside the external Python service; avoid repeatedly retrying while a previous scan is running. Do not interpret `/health` as confirmation that models are ready. Slower OCR requires performance work or coordinated proxy/backend deadlines (or an asynchronous job API).

Provider busy responses return 503, invalid provider JSON/transcripts return 502, and connection failures return 503. Raw provider errors are not forwarded to the browser.

## Factory composition

Runtime dependencies are assembled in each feature's module file. Service/controller factories import types only and receive configuration, provider clients, request functions, schemas, error factories/predicates, and loggers as arguments. Standard JavaScript built-ins remain native language primitives.

The OCR provider registry lives in `ocr.module.ts`. Its `paddle` entry uses the Paddle recognizer; its `gemini` entry uses the receipt-specific Gemini adapter. Change those bindings at the module boundary to replace an implementation. OCR dispatch does not import provider singletons. Gemini's generic service remains independent of receipt prompts and schemas.

Paddle response and line schemas are exported from `paddle.schema.ts` and supplied by its module. The OCR module supplies the receipt extractor and `ocr.schema.ts` validator to the OCR service. The controller receives the OCR service through dependency injection and calls `processReceiptImage` followed by `processReceipt`.

Vendor extraction uses explicit supplier/payee labels or a plausible document header, without a brand catalog. Customer and billing-recipient sections are excluded from header selection. Vendor identification does not assign an expense category.

Totals require an explicit total/amount-due label. Whole-number amounts, cash totals, negative amounts and common decimal/grouping separators are supported. Discount, tax and item-count labels are not totals; the extractor does not guess from the largest number. Missing or unsupported fields return null for manual review. Numeric dates retain the DMY default, using MDY when the second number exceeds 12; ambiguous dates require user confirmation.

## Frontend handoff

The scan page defaults to Gemini and sends `model=gemini` or `model=paddle`. It uses `response.ocr`, `response.fields`, `response.expenses` and `response.adjustments` for review. Confirmation sends one image and the reviewed payload to `POST /api/scans`; this is persistence, not another OCR/extraction call. Provider errors are displayed without automatic fallback. Gemini confidence remains labelled as an estimate.

## Saved scans and naira reporting

Run `npm run db:migrate` through migration 008. All ledger amounts are naira (NGN); the server defaults new scans to NGN and database checks reject other ledger currencies. Existing scans are normalized to NGN without changing their recorded amounts or original OCR snapshots. Report months are unique by month.

The scan review form selects an existing category and edits vendor, scan date, total, expense titles and costs. Category creation is in Categories. There are no tax, discount, currency or per-expense date controls. Extracted tax/discount values remain available for automatic reconciliation. Every expense inherits its scan date on the server, including when a legacy client sends a different date.

- `/scans` lists saved scans, newest first, with image thumbnails, totals, category, date, creator and review status.
- `/scans/:id` shows the image, saved fields, expenses, original OCR, reviewed transcript, approval audit and matching month report link.
- `GET /api/scans?page=1` returns `{data,total,page,pageSize}`. Workers with `expenses:view_own` see their own records; `expenses:view` allows all records. Detail reads have the same scope. Pending records are visible here but excluded from spending totals until approved.

### Review and approval

OCR lines below 60% confidence, or with unavailable confidence, are unread. Exactly 60% passes. Gemini confidence is an estimate. Correcting an unread transcript line resolves its flag; missing/non-positive extracted totals require a Supervisor after entering a positive total. Missing totals are never silently saved as zero.

`POST /api/ocr` returns `reviewToken` and `quality`. The signed token binds the user, image and original response for 24 hours. Send `reviewToken` at the top of the confirmation payload, preserve `response`, and send edits in `reviewedOcr` and the reviewed fields. Normalization is shared between signing and saving, and earlier signed drafts remain compatible until expiry.

System Supervisors with `expenses:approve` can provide `overrideReason` when saving, or use `GET /api/scans/pending?page=1` and `PATCH /api/scans/:id/override` with `{reason,total}`. Reasons require 5–1000 characters; totals must be positive decimal strings. Approval records actor, time, submitted/confirmed totals and reasons. Original OCR confidence remains unchanged. Duplicate approval returns 409.

### Report months

`/reports` lists months, budgets, spending, limits and View actions. `/reports/:id` shows the named month and usage chart. `/reports/categories` selects a month; `/reports/:id/categories` shows each category's share of the entire month budget. `/reports/review` is the Supervisor queue. `/dashboard/reports` redirects to `/reports`.

- `GET /api/reports/months?page=1` and `GET /api/reports/months/:id` require `reports:view`.
- `POST /api/reports/months` accepts `{startMonth,endMonth?,budget,approvalLimit}`. Budget may be null; amounts use decimal strings. Inclusive ranges accept 1–120 months. Existing months are skipped without changing settings. Duplicate single creation returns 409.
- `PATCH /api/reports/months/:id` accepts `{month?,budget?,approvalLimit?}` and preserves ID/creator while recording the updater. Duplicate months return 409. Both writes require a system Supervisor with `budgets:manage`.
- Reports use `/api/reports/months` and `/api/reports/months/:id`. Budget and approval-limit updates use the saved month endpoint. Currency is fixed to NGN.

Spending uses approved invoice totals by scan date, grouped by category. It does not add expense rows again. No budget yields null percentage and NO BUDGET; no expenses yields 0.00 and an empty category list. Integer-cent calculations produce one-decimal percentages. ON TRACK is ≤80%, WATCH >80–100%, OVER BUDGET >100%. Chart colors use exact backend verdicts before display rounding. The chart arc caps at 100% but the actual percentage remains visible above 100%.

Each month's expense approval limit defaults to 500.00. An expense above the limit triggers NEEDS APPROVAL over the budget verdict. Lowering a limit also surfaces existing scans that need approval unless they already have an audited override. Category usage is category spending divided by the whole month budget: 50,000 / 500,000 = 10.0%.


### Automatic scan months and expense aggregation

Migration 009 adds `expenses.month`, a stored generated date set to the first day of `expense_date`'s month. The scan save flow already assigns the scan date to every expense; clients do not submit a month. Expense responses expose `month` as `YYYY-MM`. The indexed generated field is used to aggregate approved expense costs and counts by category. Reports expose `expenseSubtotal` separately from invoice totals; budget percentages continue to use approved invoice totals. Category aggregation groups expense rows by scan before joining, so multi-item invoices are counted once.

When a scan is confirmed, the same database transaction ensures its report month exists before inserting scan/expenses. Missing months start with no budget, the configured default approval limit (500.00 when unset), and the scanning user as creator. Existing budgets, limits and audit ownership remain unchanged. Pending scans also create their month, but remain excluded from spending and approved expense subtotals. A failed save rolls back the newly created month along with the scan and expense rows. Historical missing months are backfilled by the migration.

# tracker-backend
