/**
 * Money formatting for the IQ fork.
 * The Iraqi dinar has no usable sub-unit (fils are dead), so every amount is a whole
 * number of dinars. We always use Western digits + comma grouping — Arabic-Indic digits
 * flip inside RTL text and read "٪٠٥" instead of "٥٠٪".
 */
export const DECIMALS = 0;

const grouped = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: DECIMALS,
  maximumFractionDigits: DECIMALS,
});

/** Round to whole dinars (guards against float drift from tax/discount math). */
export function roundMoney(n: number): number {
  return Math.round(Number(n) || 0);
}

/** "12,500" — number only. */
export function formatNumber(n: number): string {
  return grouped.format(roundMoney(n));
}

/** "12,500 د.ع" — with the store's currency symbol (symbol trails, as Iraqis write it). */
export function formatMoney(n: number, symbol: string): string {
  return `${formatNumber(n)} ${symbol}`.trim();
}

/** Parse what the cashier typed on the pad / in an input into whole dinars. */
export function parseMoney(raw: string): number {
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/** Iraqi banknotes in circulation, for the quick-cash buttons. */
export const IQD_NOTES = [250, 500, 1000, 5000, 10000, 25000, 50000];

/**
 * "14/09/2026 20:47" — digits only, no locale words, so it survives any bidi context
 * (Arabic-locale dates carry RLM marks that scramble inside an LTR isolate).
 */
export function formatDateTime(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
