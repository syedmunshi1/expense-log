// Currency utilities. The default is taken from the CURRENCY env var (INR),
// but an override can be stored in the settings table via /settings.

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
};

export function symbolFor(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code.toUpperCase() + " ";
}

export function formatAmount(amount: number | string, code: string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const sym = symbolFor(code);
  // Use Indian grouping for INR, western otherwise
  const locale = code.toUpperCase() === "INR" ? "en-IN" : "en-US";
  return (
    sym +
    n.toLocaleString(locale, {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}
