import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { OcrRouter } from "./modules/ocr/ocr.route";
import type { ErrorRequestHandler } from "express";
import { ApiError } from "./utils/api-error";
import { ZodError } from "zod";
import { authRouter } from "./modules/auth/auth.route";
import { accountRouter } from "./modules/account/account.route";
import { roleRouter } from "./modules/role/role.route";
import { userAdminRouter } from "./modules/users/user.route";
import { adminRouter } from "./modules/admin/admin.route";
import { categoryRouter } from "./modules/category/category.route";
import { scansRouter } from "./modules/scans/scans.route";
import { reportsRouter } from './modules/reports/reports.route';

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
morgan.token("safe-url",req=>req.url?.split("?")[0]??"/");
app.use(morgan(":method :safe-url :status :response-time ms"));
app.use(express.json({ limit: "10kb" }));

app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

app.use("/api/ocr", OcrRouter);
app.use("/api/auth",authRouter);
app.use("/api/account",accountRouter);
app.use("/api/roles",roleRouter);
app.use("/api/users",userAdminRouter);
app.use("/api/admin",adminRouter);
app.use("/api/categories",categoryRouter);
app.use("/api/scans",scansRouter);
app.use('/api/reports',reportsRouter);

app.get("/", (_req, res) => {
  res.json({
    message: "Backend API is running.",
  });
});

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({message:"Invalid request.",errors:error.issues.map(issue=>({field:issue.path.join("."),message:issue.message}))});
    return;
  }
  if(error?.name==="MulterError"){
    res.status(error.code==="LIMIT_FILE_SIZE"?413:400).json({message:error.code==="LIMIT_FILE_SIZE"?"Image must be 10 MB or smaller.":"Send one image and one receipt payload within the upload limits."});return;
  }
  if (error?.code === "23505") { res.status(409).json({message:error.constraint==="categories_name_ci"?"A category with that name already exists. Select it from the category list.":"Email, username, or role name is already in use."}); return; }
  if (["42P01","3F000"].includes(error?.code)) { res.status(503).json({message:"Database schema is not ready. Run the auth migration."}); return; }
  if (["ECONNREFUSED","ETIMEDOUT","ENOTFOUND","28P01","57P01","53300"].includes(error?.code)) { res.status(503).json({message:"Database is temporarily unavailable."}); return; }
  const statusCode = error instanceof ApiError ? error.statusCode :
    typeof error.status === "number" ? error.status : 500;
  res.status(statusCode).json({ message: error instanceof ApiError ? error.message : "Request failed." });
};
app.use(errorHandler);

export { app };
