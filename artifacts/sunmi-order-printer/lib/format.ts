export function formatMoney(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} ر.س`;
}