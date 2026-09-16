export function hourInTz(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date);
  return Number(hour);
}

export function shouldRunNightly(date: Date, timeZone: string, hour = 2): boolean {
  return hourInTz(date, timeZone) === hour;
}
