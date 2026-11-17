# Receipt review and persistence

The read and confirmation steps are separate. `POST /api/ocr?model=gemini|paddle` reads an image without uploading or storing it. Confirm details sends the original image and reviewed data to `POST /api/scans`; the backend uploads to Cloudinary and commits the scan and expense rows together.

## Categories

`GET /api/categories` requires `categories:view`, granted to Workers and Supervisors. It returns `{data: [{id,name,description,createdAt,createdBy}]}` across all creators. `createdBy` references the creating user for audit, not tenant ownership.

`POST /api/categories` accepts `{name,description?}` and requires a system Supervisor with `categories:create`. Names are unique ignoring case. The frontend provides this action in Categories; the scan form only selects existing categories. Workers select existing categories.

`PATCH /api/categories/:id` accepts `{name?,description?}` and requires a system Supervisor with `categories:update`. At least one field is required. Names allow 1–100 characters; descriptions allow 0–500. Updates preserve the original creator and creation timestamp.

`DELETE /api/categories/:id` requires a system Supervisor with `categories:delete`. It returns 204 for an unused category, 404 for a missing category and 409 when saved scans reference it. The database foreign key also protects concurrent receipt saves from category deletion. The frontend Categories section provides creation, editing, search and confirmed deletion, with read-only controls for viewers. Migration 005 grants update/delete permissions to Supervisors.

## Read response

The existing `{ocr,fields,needsReview:true}` response now also contains:

```json
{
  "expenses": [{"title":"Logo design","cost":1000,"sourceLineIndexes":[12,13,14,15]}],
  "adjustments": {"tax":340,"discount":null,"currency":null}
}
```

Costs are printed line subtotals, not unit prices. Tax, discounts, payment rows and grand totals are excluded from expenses. Gemini returns structured candidates in the original model call while continuing to estimate confidence per OCR line. Paddle uses local item-table parsing, grouping text by coordinates when available. Ambiguous amounts remain null, and unsupported/missing rows can be added manually. Extraction is always subject to review.

## Confirm and save

`POST /api/scans` requires `receipts:scan` and `expenses:create`. Send multipart form data with one `image` file (maximum 10 MB) and one `payload` JSON string (maximum 512 KB):

```json
{
  "reviewToken":"signed token returned by the OCR response",
  "requestId":"UUID generated for this scan confirmation",
  "categoryId":"existing category UUID",
  "vendor":"LICERIA & CO.",
  "date":"2030-08-12",
  "total":"4860.00",
  "tax":"340.00",
  "discount":null,
  "response":{"ocr":{"text":"...","model":"...","lines":[]},"fields":{"vendor":null,"date":null,"total":null},"needsReview":true},
  "reviewedOcr":{"text":"...","model":"...","lines":[]},
  "expenses":[{"title":"Logo design","cost":"1000.00","sourceLineIndexes":[]}]
}
```

The response includes `{data: savedScan,message}` with scan ID, category ID, reviewed vendor/date/total, image URL, reconciliation flag and saved expenses. Monetary inputs are decimal strings with at most two decimal places, stored as PostgreSQL `numeric(14,2)`. All ledger amounts are naira. Currency defaults to NGN and cannot be changed. Each expense date is set to the scan date by the backend.

One category belongs to each scan. Every expense inherits that category through `scan_id`; there is no repeated per-expense category selector. `image_url` and `image_public_id` are dedicated scan columns, outside the OCR JSON. The original response and reviewed OCR are stored separately from the edited header and expense columns.

The backend compares the expense sum plus known tax minus known discount with the reviewed document total using integer cents. A discrepancy does not rewrite the costs or allocate adjustments. It is shown before confirmation and stored as `reconciled: false`. For the supplied invoice, 1000+1200+1500+1500+340 is 5540, which differs from its printed 4860.

A stable request ID prevents duplicate confirmation writes. The same user/request/content returns the existing scan; different content with an already-used ID returns 409. Images are uploaded before the database transaction. Failed saves and concurrent duplicate uploads trigger image cleanup; cleanup failures are logged without receipt data or credentials.

## Read saved records

`GET /api/scans?page=1` returns `{data,total,page,pageSize}` with 25 newest records, including expenses, category name, creator name and matching report-month ID. The frontend exposes `/scans` and `/scans/:id`. `GET /api/scans/:id` retrieves one scan with its response, reviewed OCR and expenses. `expenses:view_own` limits reads to the caller; `expenses:view` permits application-wide reads. Explicit permission denies apply. Save ownership always comes from the authenticated user.

## Configuration and verification

Set server-only `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`, then run `npm run db:migrate`. Credentials are never passed to the frontend. Missing storage configuration returns 503; upload failures return 502 without database writes.

The migration creates categories, scans and expenses. Live verification covered Gemini candidates/confidence, Paddle invoice parsing, Cloudinary upload/cleanup, decimal database writes and owner filtering. Validation database records were rolled back and the generated image removed. No test files were added.


## Automatic months

Confirmation creates a missing report month transactionally, using the reviewed scan date. Existing month settings are preserved. Each expense has a generated `month` field derived from its inherited scan date, returned as `YYYY-MM`. Approved expense costs are aggregated through this field as `expenseSubtotal`; monthly budget usage retains approved invoice totals. The frontend displays both figures and the expense month in saved scan details. Apply migration 009.
