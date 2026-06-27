export function formatCurrency(halalas: number): string {
  const sar = halalas / 100;
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2
  }).format(sar);
}

export function formatEasternNumber(num: number | string): string {
  return String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d as any]);
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(dateStr));
}
