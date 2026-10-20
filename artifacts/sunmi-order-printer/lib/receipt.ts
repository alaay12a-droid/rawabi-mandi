import type { Order, Settings } from './types';

export interface ReceiptLine {
  text: string;
  size?: number;
  alignment?: 'left' | 'center' | 'right';
}

const money = (value: number) => `${(value / 100).toFixed(2)} ر.س`;

export function buildReceipt(
  order: Order,
  settings: Pick<Settings, 'storeName' | 'paperWidth'>,
  kind: 'customer' | 'kitchen',
  reason?: string,
): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  const add = (text: string, size = 24, alignment: ReceiptLine['alignment'] = 'right') =>
    lines.push({ text, size, alignment });
  const separator = settings.paperWidth === 80 ? '------------------------------------------' : '----------------------------';
  add(settings.storeName || 'روابي المندي', 30, 'center');
  add(kind === 'kitchen' ? 'نسخة المطبخ' : 'نسخة العميل', 22, 'center');
  add(`طلب #${order.dailyNumber}`, 36, 'center');
  add(new Date(order.createdAt).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' }), 20, 'center');
  add(separator, 20, 'center');
  add(`العميل: ${order.customerName}`);
  if (kind === 'customer' && order.customerPhone) add(`الهاتف: ${order.customerPhone}`);
  add(order.orderType === 'delivery' ? 'نوع الطلب: توصيل' : 'نوع الطلب: استلام من الفرع');
  if (order.branchName) add(`الفرع: ${order.branchName}`);
  if (kind === 'customer' && order.customerAddress) add(`العنوان: ${order.customerAddress}`);
  if (order.driverName) add(`المندوب: ${order.driverName}`);
  add(separator, 20, 'center');
  for (const item of order.items) {
    add(`${item.quantity} × ${item.name}`, 26);
    const customization = item.customization;
    if (customization) {
      const options = [
        customization.size,
        customization.riceType,
        customization.addon,
        ...(customization.selectedOptions ?? []).map(option => `${option.groupName}: ${option.choice}`),
      ].filter(Boolean);
      for (const option of [...new Set(options)]) add(`  ${option}`, 20);
    }
    if (item.notes) add(`ملاحظة الصنف: ${item.notes}`, 20);
    if (kind === 'customer') add(`${money(item.price)} × ${item.quantity} = ${money(item.price * item.quantity)}`, 20, 'left');
  }
  if (order.notes) add(`ملاحظات الطلب: ${order.notes}`, 22);
  if (kind === 'customer') {
    add(separator, 20, 'center');
    if (order.taxAmount != null) add(`الضريبة: ${money(order.taxAmount)}`);
    else add('تفصيل الضريبة غير متاح في بيانات الطلب', 18);
    if (order.discountAmount > 0) add(`الخصم: ${money(order.discountAmount)}`);
    add(`رسوم التوصيل: ${money(order.deliveryFee ?? 0)}`);
    add(`الإجمالي: ${money(order.totalPrice)}`, 30, 'center');
    const methods: Record<string, string> = { cash: 'نقدًا', card: 'بطاقة', apple_pay: 'Apple Pay', mada: 'مدى', online: 'إلكتروني' };
    const method = methods[order.paymentMethod];
    add(`طريقة الدفع: ${method ?? order.paymentMethod ?? 'غير محددة'}`);
  }
  if (reason) {
    add('إعادة طباعة', 24, 'center');
    add(`السبب: ${reason}`, 20);
  }
  return lines;
}
