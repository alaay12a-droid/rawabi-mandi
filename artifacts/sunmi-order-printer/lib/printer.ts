import { Platform } from 'react-native';
import type { Order } from './types';
import { getSettings } from './storage';
import { buildReceipt } from './receipt';

type SunmiPrinterModule = typeof import('@mitsuharu/react-native-sunmi-printer-library');

let printerModule: SunmiPrinterModule | null = null;

function getSunmiPrinter(): SunmiPrinterModule {
  if (Platform.OS !== 'android') {
    throw new Error('تتطلب الطباعة تطبيق Android مثبتًا على جهاز Sunmi.');
  }

  printerModule ??= require('@mitsuharu/react-native-sunmi-printer-library') as SunmiPrinterModule;
  return printerModule;
}

let busy = false;
let lastError: string | null = null;
export const getLastPrinterError = () => lastError;

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
  if (busy) {
    lastError = 'الطابعة مشغولة. انتظر انتهاء الفاتورة الحالية';
    return false;
  }
  busy = true;
  lastError = null;
  let SunmiPrinter: SunmiPrinterModule | null = null;
  try {
    const settings = await getSettings();
    if (!settings.customerCopy && !settings.kitchenCopy) throw new Error('فعّل نسخة العميل أو المطبخ في الإعدادات');
    SunmiPrinter = await preparePrinter();
    const kinds: Array<'customer' | 'kitchen'> = [];
    if (settings.customerCopy) kinds.push('customer');
    if (settings.kitchenCopy) kinds.push('kitchen');
    const copies = Math.min(5, Math.max(1, Math.floor(settings.copies)));
    for (let copy = 0; copy < copies; copy++) {
      for (const kind of kinds) {
        await SunmiPrinter.enterPrinterBuffer(true);
        for (const line of buildReceipt(order, settings, kind, reprintReason)) {
          await printLine(SunmiPrinter, line.text, line.size, line.alignment);
        }
        await SunmiPrinter.setAlignment('center');
        await SunmiPrinter.printQRCode(`RAWABI-ORDER:${order.id}`, settings.paperWidth === 80 ? 6 : 4, 'middle');
        await SunmiPrinter.lineWrap(4);
        await SunmiPrinter.exitPrinterBuffer(true);
      }
    }
    return true;
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'فشلت الطباعة';
    console.error('[SunmiPrinter] Error printing:', e);
    try { await SunmiPrinter?.exitPrinterBuffer(false); } catch {}
    return false;
  } finally {
    busy = false;
  }
};

export const printTest = async (): Promise<boolean> => {
  if (busy) return false;
  busy = true;
  lastError = null;
  try {
    const SunmiPrinter = await preparePrinter();
    await printLine(SunmiPrinter, 'اختبار الطباعة', 30, 'center');
    await printLine(SunmiPrinter, 'الطابعة متصلة وجاهزة', 24, 'center');
    await SunmiPrinter.lineWrap(4);
    return true;
  } catch (e) {
    lastError = e instanceof Error ? e.message : 'فشل اختبار الطباعة';
    console.error('[SunmiPrinter] Error testing print:', e);
    return false;
  } finally {
    busy = false;
  }
};
