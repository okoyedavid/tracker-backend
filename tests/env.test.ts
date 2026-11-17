import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function loadConfig(port: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", PORT: port };
  delete env.DATABASE_URL;
  delete env.DATABASE_URL_POOLED;
  delete env.GEMINI_MODEL;
  delete env.GEMINI_ALLOWED_MODELS;
  return spawnSync(process.execPath, ["--import", "tsx", "-e", "require('./src/config/env.ts')"], { env, encoding: "utf8" });
}

test("OCR configuration loads without unused database URLs", () => {
  const result = loadConfig("5000");
  assert.equal(result.status, 0, result.stderr);
});

test("rejects invalid listening ports", () => {
  for (const port of ["0", "-1", "65536", "1.5", ""]) {
    assert.notEqual(loadConfig(port).status, 0, `accepted port ${port}`);
  }
});
