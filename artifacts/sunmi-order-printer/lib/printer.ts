import { Platform } from 'react-native';
import * as SunmiPrinter from '@mitsuharu/react-native-sunmi-printer-library';
import type { Order, OrderItem } from './types';

const money = (minorUnits: number) => `${(minorUnits / 100).toFixed(2)} ر.س`;

async function preparePrinter() {
  if (Platform.OS !== 'android') throw new Error('تتطلب الطباعة تطبيق Android مثبتًا على جهاز Sunmi.');
  const ready = await SunmiPrinter.prepare();
  if (!ready) throw new Error('تعذر الاتصال بطابعة Sunmi الداخلية.');
}

async function printLine(text: string, size = 24, alignment: 'left' | 'center' | 'right' = 'right') {
  await SunmiPrinter.setAlignment(alignment);
  await SunmiPrinter.setFontSize(size);
  await SunmiPrinter.printText(`${text}\n`);
}

export const printOrder = async (order: Order, reprintReason?: string): Promise<boolean> => {
  try {
    await preparePrinter();
    await SunmiPrinter.enterPrinterBuffer(true);
    await printLine('طابعة الطلبات المستقلة', 30, 'center');
    await printLine(`طلب #${order.dailyNumber}`, 40, 'center');
    await printLine('--------------------------------', 22, 'center');
    await printLine(`الاسم: ${order.customerName}`);
    await printLine(`الهاتف: ${order.customerPhone}`);
    await printLine(`النوع: ${order.orderType === 'delivery' ? 'توصيل' : 'استلام'}`);
    if (order.customerAddress) await printLine(`العنوان: ${order.customerAddress}`);
    if (order.notes) await printLine(`ملاحظات: ${order.notes}`);
    await printLine('--------------------------------', 22, 'center');
    for (const item of order.items) {
      await printLine(`${item.quantity} × ${item.name}`);
      await printLine(`${money(item.price * item.quantity)}`, 22, 'left');
      if (item.notes) await printLine(`  ${item.notes}`, 20);
    }
    await printLine('--------------------------------', 22, 'center');
    if (order.discountAmount > 0) await printLine(`الخصم: ${money(order.discountAmount)}`);
    if (order.deliveryFee > 0) await printLine(`رسوم التوصيل: ${money(order.deliveryFee)}`);
    await printLine(`الإجمالي: ${money(order.totalPrice)}`, 30, 'center');
    if (reprintReason) {
      await printLine('إعادة طباعة', 24, 'center');
      await printLine(`السبب: ${reprintReason}`, 22, 'center');
    }
    await SunmiPrinter.lineWrap(4);
    await SunmiPrinter.exitPrinterBuffer(true);
    return true;
  } catch (e) {
    console.error('[SunmiPrinter] Error printing:', e);
    try { await SunmiPrinter.exitPrinterBuffer(false); } catch {}
    return false;
  }
};

export const printTest = async (): Promise<boolean> => {
  try {
    await preparePrinter();
    await printLine('اختبار الطباعة', 30, 'center');
    await printLine('الطابعة متصلة وجاهزة', 24, 'center');
    await SunmiPrinter.lineWrap(4);
    return true;
  } catch (e) {
    console.error('[SunmiPrinter] Error testing print:', e);
    return false;
  }
};
