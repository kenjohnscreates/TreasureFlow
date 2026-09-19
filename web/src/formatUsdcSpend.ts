/** Qty is USDC spend, not BTC. 0.53164 -> "$0.53 USDC". */
export function formatUsdcSpend(qtyUsdc: string | undefined): string {
  if (qtyUsdc === undefined || qtyUsdc === "") return "--";
  const n = Number(qtyUsdc);
  if (!Number.isFinite(n)) return qtyUsdc;
  return `$${n.toFixed(2)} USDC`;
}
