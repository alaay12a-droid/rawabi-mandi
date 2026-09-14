import { Platform } from 'react-native';
import type { Order, OrderItem } from './types';

type SunmiPrinterModule = typeof import('@mitsuharu/react-native-sunmi-printer-library');

let printerModule: SunmiPrinterModule | null = null;

function getSunmiPrinter(): SunmiPrinterModule {
  if (Platform.OS !== 'android') {
    throw new Error('تتطلب الطباعة تطبيق Android مثبتًا على جهاز Sunmi.');
  }

  printerModule ??= require('@mitsuharu/react-native-sunmi-printer-library') as SunmiPrinterModule;
  return printerModule;
}

const money = (minorUnits: number) => `${(minorUnits / 100).toFixed(2)} ر.س`;

async function preparePrinter() {
  const SunmiPrinter = getSunmiPrinter();
  const ready = await SunmiPrinter.prepare();
  if (!ready) throw new Error('تعذر الاتصال بطابعة Sunmi الداخلية.');
  return SunmiPrinter;
}

async function printLine(
  SunmiPrinter: SunmiPrinterModule,
  text: string,
  size = 24,
  alignment: 'left' | 'center' | 'right' = 'right',
) {
  await SunmiPrinter.setAlignment(alignment);
  await SunmiPrinter.setFontSize(size);
  await SunmiPrinter.printText(`${text}\n`);
}

export const printOrder = async (order: Order, reprintReason?: string): Promise<boolean> => {
  let SunmiPrinter: SunmiPrinterModule | null = null;
  try {
    SunmiPrinter = await preparePrinter();
    await SunmiPrinter.enterPrinterBuffer(true);
    await printLine(SunmiPrinter, 'روابي المندي', 30, 'center');
    await printLine(SunmiPrinter, `طلب #${order.dailyNumber}`, 40, 'center');
    await printLine(SunmiPrinter, '--------------------------------', 22, 'center');
    await printLine(SunmiPrinter, `الاسم: ${order.customerName}`);
    await printLine(SunmiPrinter, `الهاتف: ${order.customerPhone}`);
    await printLine(SunmiPrinter, `النوع: ${order.orderType === 'delivery' ? 'توصيل' : 'استلام'}`);
    if (order.customerAddress) await printLine(SunmiPrinter, `العنوان: ${order.customerAddress}`);
    if (order.notes) await printLine(SunmiPrinter, `ملاحظات: ${order.notes}`);
    await printLine(SunmiPrinter, '--------------------------------', 22, 'center');
    for (const item of order.items) {
      await printLine(SunmiPrinter, `${item.quantity} × ${item.name}`);
      await printLine(SunmiPrinter, `${money(item.price * item.quantity)}`, 22, 'left');
      if (item.notes) await printLine(SunmiPrinter, `  ${item.notes}`, 20);
    }
    await printLine(SunmiPrinter, '--------------------------------', 22, 'center');
    if (order.discountAmount > 0) await printLine(SunmiPrinter, `الخصم: ${money(order.discountAmount)}`);
    if (order.deliveryFee > 0) await printLine(SunmiPrinter, `رسوم التوصيل: ${money(order.deliveryFee)}`);
    await printLine(SunmiPrinter, `الإجمالي: ${money(order.totalPrice)}`, 30, 'center');
    if (reprintReason) {
      await printLine(SunmiPrinter, 'إعادة طباعة', 24, 'center');
      await printLine(SunmiPrinter, `السبب: ${reprintReason}`, 22, 'center');
    }
    await SunmiPrinter.lineWrap(4);
    await SunmiPrinter.exitPrinterBuffer(true);
    return true;
  } catch (e) {
    console.error('[SunmiPrinter] Error printing:', e);
    try { await SunmiPrinter?.exitPrinterBuffer(false); } catch {}
    return false;
  }
};

export const printTest = async (): Promise<boolean> => {
  try {
    const SunmiPrinter = await preparePrinter();
    await printLine(SunmiPrinter, 'اختبار الطباعة', 30, 'center');
    await printLine(SunmiPrinter, 'الطابعة متصلة وجاهزة', 24, 'center');
    await SunmiPrinter.lineWrap(4);
    return true;
  } catch (e) {
    console.error('[SunmiPrinter] Error testing print:', e);
    return false;
  }
};
