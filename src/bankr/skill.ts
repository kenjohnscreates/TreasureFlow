import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../errors.ts";
import { isRecord } from "./parse.ts";
import { parseSkillTx, type SkillTx } from "./skillTx.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const SKILL_ENTRY = path.join(ROOT, "vendor/aero-stock-lp/scripts/entry.mjs");
export const SKILL_STATE = path.join(ROOT, ".data/aero-stock-lp.json");

export type SkillPhase = "plan" | "size" | "settle";

export type SkillResult = {
  ok: true;
  phase: SkillPhase;
  report: string;
  next?: string;
  txs: SkillTx[];
  raw: Record<string, unknown>;
};

export async function runEntry(
  phase: SkillPhase,
  flags: Record<string, string>,
): Promise<SkillResult> {
  const args = [SKILL_ENTRY, phase];
  for (const [key, value] of Object.entries(flags)) {
    args.push(`--${key}`, value);
  }
  const parsed = await spawnJson(args);
  if (!isRecord(parsed) || parsed.ok !== true) {
    const gate =
      isRecord(parsed) && typeof parsed.gate === "string" ? parsed.gate : "skill";
    throw new AppError("skill_gate", `aero-stock-lp ${phase} failed: ${gate}`);
  }
  if (parsed.phase !== phase) {
    throw new AppError("skill_phase", "aero-stock-lp phase mismatch");
  }
  const txs = Array.isArray(parsed.txs) ? parsed.txs.map(parseSkillTx) : [];
  const report = typeof parsed.report === "string" ? parsed.report : "";
  const next = typeof parsed.next === "string" ? parsed.next : undefined;
  const result: SkillResult = { ok: true, phase, report, txs, raw: parsed };
  if (next) result.next = next;
  return result;
}

function spawnJson(argv: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new AppError("skill_timeout", "aero-stock-lp timed out"));
    }, 60_000);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new AppError("skill_spawn", err.message));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(stdout) as unknown);
      } catch {
        reject(
          new AppError(
            "skill_json",
            code === 0 ? "aero-stock-lp stdout was not JSON" : "aero-stock-lp failed",
          ),
        );
        void stderr;
      }
    });
  });
}
