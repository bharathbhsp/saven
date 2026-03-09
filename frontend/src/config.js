// App name: "SavenDev" when running locally (npm run dev) or when VITE_APP_NAME=SavenDev / deploy-frontend.sh dev; "Saven" for prod.
export const APP_NAME =
  import.meta.env.VITE_APP_NAME ||
  (import.meta.env.DEV ? "SavenDev" : "Saven");

// Default currency: rupees (INR). All amounts are recorded and displayed in ₹.
export const CURRENCY_CODE = "INR";
export const CURRENCY_SYMBOL = "₹";

/** Format a signed number as currency (e.g. "₹1,234.56" or "-₹500.00"). No space between symbol and amount. */
export function formatCurrency(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${CURRENCY_SYMBOL}—`;
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-${CURRENCY_SYMBOL}${formatted}` : `${CURRENCY_SYMBOL}${formatted}`;
}
