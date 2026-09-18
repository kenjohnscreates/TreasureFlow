import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import type { Context, Next } from "hono";

export const WEB_DIST_REL = join("web", "dist");

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function webDistDir(cwd = process.cwd()): string {
  return resolve(cwd, WEB_DIST_REL);
}

function withinDist(distRoot: string, candidate: string): boolean {
  const rel = relative(distRoot, candidate);
  if (!rel || rel === "..") return false;
  return !rel.startsWith(`..${sep}`) && !rel.startsWith("..");
}

export function resolveWebAsset(pathname: string, dist = webDistDir()): string | null {
  let raw = pathname.split("?")[0] ?? "/";
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!raw.startsWith("/") || raw.includes("\0")) return null;

  const distRoot = resolve(dist);
  const rel = raw === "/" ? "index.html" : raw.replace(/^\/+/u, "");
  const candidate = resolve(distRoot, rel);
  if (!withinDist(distRoot, candidate)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  const spa = raw === "/app" || raw.startsWith("/app/");
  if (!spa) return null;
  const index = join(distRoot, "index.html");
  if (existsSync(index) && statSync(index).isFile()) return index;
  return null;
}

export function mimeForFile(file: string): string {
  return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
}

export async function serveWebDist(c: Context, dist = webDistDir()): Promise<Response> {
  const file = resolveWebAsset(c.req.path, dist);
  if (!file) return c.notFound();
  const bytes = readFileSync(file);
  return c.body(new Uint8Array(bytes), 200, { "Content-Type": mimeForFile(file) });
}

export async function vercelWebStatic(c: Context, next: Next): Promise<Response | void> {
  if (!process.env.VERCEL) {
    await next();
    return;
  }
  return serveWebDist(c);
}
