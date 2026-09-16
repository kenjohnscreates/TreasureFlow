type LogFields = Record<string, string | number | boolean | bigint>;

export function log(event: string, fields: LogFields = {}): void {
  const body: Record<string, string | number | boolean> = { event };
  for (const [key, value] of Object.entries(fields)) {
    body[key] = typeof value === "bigint" ? value.toString() : value;
  }
  process.stdout.write(`${JSON.stringify(body)}\n`);
}
