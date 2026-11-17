# Authentication and RBAC

Authentication follows the archive's controller/service/module composition, with PostgreSQL replacing Mongoose. Runtime dependencies are supplied by factories through module files. Roles are application-wide Supervisor and Worker; no business, ABAC or policy system is included.

## Setup

1. Set `DATABASE_URL` (direct connection, preferred for migrations) and optionally `DATABASE_URL_POOLED` (preferred for API requests).
2. Set distinct random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, each at least 32 characters. These have already been generated in the local `.env`; keep them private and stable across restarts.
3. Set `CLIENT_URL` to the frontend origin, normally `http://localhost:3000`. Forward frontend `/api/*` requests to Node on port 5000 so cookies remain on the frontend host.
4. Configure `RESEND_API_KEY` and `EMAIL_FROM` using a sender authorized in Resend. Registration, verification, password reset and email change require email delivery. Missing configuration returns 503; codes are never returned by the API or logged.
5. For Google login, configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URL`. Register the exact redirect URL on your Google OAuth Web Application, normally `http://localhost:3000/api/auth/google/callback`. These credentials are separate from the Gemini API key.
6. Run `npm run db:migrate`, then `npm run dev`. Production: `npm run build` and `npm start`. The migration creates an isolated `receipt_tracker` schema and is safe to rerun.

Public registration and Google signup always create Workers. After creating your first account, promote it explicitly:

```powershell
npm run auth:supervisor -- supervisor@example.com
```

There is no automatic first-user elevation or public supervisor signup. The local database migration has been applied. Google and email credentials still need configuration before those external flows can be used.

## Frontend contract

Use same-origin `/api` calls through the frontend proxy. Authentication uses HttpOnly cookies: access tokens expire after 15 minutes and refresh tokens after 7 days. Tokens are not returned in JSON. Use `credentials: "include"` for requests. In production cookies require HTTPS.

| Method and path | JSON body / behavior |
| --- | --- |
| `POST /api/auth/register` | `{name, email, password}`; returns 201 `{message, user}`, sends verification code; does not log in |
| `POST /api/auth/login` | `{email, password}`; sets cookies, returns `{message, user}` |
| `GET /api/auth/me` | Returns `{success: true, message, data: user}`; unauthenticated returns 401 |
| `POST /api/auth/refresh` | Rotates refresh cookie, returns `{message, userSession}` |
| `POST /api/auth/logout` | Revokes session and clears cookies |
| `POST /api/auth/verify-email` | `{email, otp}` |
| `POST /api/auth/resend-email` | `{email}` |
| `POST /api/auth/password/forgot` | `{email}`; generic response to avoid disclosing account existence |
| `PATCH /api/auth/password/reset` | `{email, otp, newPassword}`; revokes sessions, requires login again |
| `GET /api/auth/google` | Navigate browser here to begin Google login |
| `GET /api/auth/google/callback` | Backend callback; redirects to `CLIENT_URL?google=success`, `error`, `account_conflict` or `account_inactive` |

After Google success, fetch `/api/auth/me`. Existing unverified password accounts cannot be automatically linked to Google; verify the account first. Google credentials, authorization codes and tokens stay on the backend.

Serialize refresh calls in the frontend. A competing refresh within the 20-second rotation grace period returns 409; reuse after that revokes the session chain. Retry the original request only after a successful refresh; clear the signed-in state when refresh fails with 401. Rate limits return 429. Render the backend `{message}` for errors; validation failures return 400.

Passwords require 8–72 characters, at most 72 UTF-8 bytes, with uppercase, lowercase and a number. OTPs are six digits, expire after 15 minutes, allow five failed attempts and have a 60-second resend cooldown. Login currently allows unverified password accounts, matching the original project's behavior.

## Account updates

All account routes require authentication.

| Method and path | Body / behavior |
| --- | --- |
| `PATCH /api/account/me` | Any of `{name, username, bio}`; username/bio may be null |
| `PATCH /api/account/me/avatar` | `{avatar: "https://..."}`; stores URL only |
| `DELETE /api/account/me/avatar` | Clears avatar URL |
| `PATCH /api/account/me/password` | `{currentPassword, newPassword}`; replaces all sessions with a fresh current session |
| `POST /api/account/me/email/change` | `{newEmail, currentPassword}`; sends OTP to new email |
| `PATCH /api/account/me/email/change` | `{otp}`; changes email, disconnects Google identity, revokes sessions |

Google-only accounts must set a password using password reset before changing email/password. Profile updates cannot change roles or account status. Avatar file uploads/deletion and MFA are not implemented.

## Roles and administration

Workers can scan receipts, select shared categories and create/view their own saved scans and expenses. Supervisors can create categories and view application-wide scans, in addition to administration permissions. Supervisors can approve flagged scans and manage monthly budgets and approval limits. Expense deletion remains reserved for future use. Explicit denies override grants. System roles cannot be edited or archived. See [receipt storage](RECEIPTS.md) for the category, confirmation and saved-record routes.

| Method and path | Required permission / body |
| --- | --- |
| `GET /api/roles` | `roles:view` |
| `POST /api/roles` | `roles:manage`; `{name, permissions, deniedPermissions}` |
| `PATCH /api/roles/:roleId` | `roles:manage`; any of the role creation fields |
| `DELETE /api/roles/:roleId` | `roles:manage`; archives an unassigned custom role |
| `PATCH /api/users/:userId/role` | `roles:assign`; `{roleId}` |
| `PATCH /api/users/:userId/status` | `users:manage`; `{status: "active"}` or `{status: "inactive"}` |
| `POST /api/users` | System Supervisor with `user:create`; `{name, email, password, deliveryEmail?}` |

Role/user IDs are UUIDs. Administrators cannot change their own role/status or grant permissions they do not hold. The current role and account status are loaded for authenticated requests, so changes take effect without waiting for token expiry. Multiple users may hold the Supervisor role; only the role definition's key is unique.

## Admin user directory

`GET /api/admin/users` requires authentication and `users:view` (explicit denies still win). It lists application users across all roles and statuses. Optional query parameters are `page` (default 1), `limit` (default 25, maximum 100), `search` (up to 120 characters; matches name, email or role name), `status` (`active` or `inactive`) and `roleId` (UUID). Repeated/unknown query parameters fail validation.

Response: `{success: true, data: [{id, name, email, username, avatar, status, emailVerifiedAt, createdAt, role: {id, name, key, type, status}}], pagination: {page, limit, total, pageCount}}`. Password hashes, Google subjects, delivery/recovery addresses and tokens are excluded at the SQL projection. Responses use `Cache-Control: no-store`. Search/filter results and counts are calculated in the same database statement.

The frontend Users page consumes this endpoint and exposes separate creation, role-assignment and status controls according to `user:create`, `roles:assign`/`roles:view` and `users:manage`. `users:view` by itself grants read-only directory access. Creating accounts remains restricted to system Supervisors with `user:create`.

`POST /api/ocr?model=gemini` and `POST /api/ocr?model=paddle` retain the existing single-request receipt response, but now require a signed-in user with `receipts:scan`. No changes are needed to the OCR request body or successful response shape.

## Supervisor account provisioning

`POST /api/users` creates an active Worker directly, bypassing public registration and email verification. Authentication, the system Supervisor role, `user:create`, strict input validation and unique login email remain required. The Supervisor supplies `password`, using the normal password policy; only its bcrypt hash is stored. No forced password change or expiration is added. The password is never returned in the API response or logged.

Delivery is explicitly optional. When `deliveryEmail` is provided, credentials are emailed only to that address. When omitted or blank, no email is sent and email-provider configuration is not required; the login email can be a dummy address such as `user1@example.com`. There is no fallback to the login address for sending account credentials. The frontend retains the chosen password in component memory and stays on an Account ready screen with email/password and a button that copies both. Closing the screen discards the readable password.

The response is `201 {message, data: user, deliveryEmail: string | null, deliveryMethod: "manual" | "email"}`. `users.created_by` references the provisioning supervisor for audit. When supplied, `users.delivery_email` retains the real inbox for password resets. Confirming an account email change clears that override. Requested email delivery failure rolls back account creation; provider acceptance is not proof of inbox delivery.

Run `npm run db:migrate` for the permission and audit-field migrations before using this endpoint. The frontend exposes this action on Users. Public signup still cannot provision roles or bypass verification.
