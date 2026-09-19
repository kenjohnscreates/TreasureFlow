import path from "node:path";

export function runtimeFile(localName: string, vercelName: string): string {
  if (process.env.VERCEL) return `/tmp/${vercelName}`;
  return path.join(".data", localName);
}

export function pauseFilePath(): string {
  return runtimeFile("paused.json", "treasureflow-paused.json");
}

export function spendFilePath(): string {
  return runtimeFile("spend.json", "treasureflow-spend.json");
}

export function challengeFilePath(): string {
  return runtimeFile("challenge.json", "treasureflow-challenge.json");
}

export function demoFlashFilePath(): string {
  return runtimeFile("flash-demo.json", "treasureflow-flash-demo.json");
}
