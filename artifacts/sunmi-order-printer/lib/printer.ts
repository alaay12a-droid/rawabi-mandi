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

  try {
    const module = printerModule
      ?? require('@mitsuharu/react-native-sunmi-printer-library') as SunmiPrinterModule;
    if (typeof module.prepare !== 'function') throw new Error('وحدة الطباعة الأصلية غير متاحة');
    printerModule = module;
    return module;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`تعذر تحميل طابعة Sunmi على هذا الجهاز. يمكنك استخدام التطبيق دون طباعة. ${details}`);
  }
}

let busy = false;
let lastError: string | null = null;
export const getLastPrinterError = () => lastError;

// A native Promise may never settle if the printer service disconnects or
// omits a callback. Bound each step, not just the outer job: a timed-out job
// must never resume submitting the rest of its receipt later.
async function printerStep<T>(stage: string, action: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(
          `انتهت مهلة الطابعة أثناء: ${stage}. قد تخرج نسخة متأخرة؛ تحقق من الورق قبل إعادة الطباعة.`,
        )), 15000);
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${stage}: ${message}`);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function preparePrinter() {
  const SunmiPrinter = getSunmiPrinter();
  const ready = await printerStep('الاتصال وتهيئة طابعة Sunmi', () => SunmiPrinter.prepare());
  if (!ready) throw new Error('تعذر الاتصال بطابعة Sunmi الداخلية.');
  return SunmiPrinter;
}

async function printLine(
  SunmiPrinter: SunmiPrinterModule,
  text: string,
  size = 24,
  alignment: 'left' | 'center' | 'right' = 'right',
) {
  await printerStep('ضبط محاذاة النص', () => SunmiPrinter.setAlignment(alignment));
  await printerStep('ضبط حجم الخط', () => SunmiPrinter.setFontSize(size));
  await printerStep('طباعة سطر الفاتورة', () => SunmiPrinter.printText(`${text}\n`));
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
    const settings = await printerStep('قراءة إعدادات الطباعة', getSettings);
    if (!settings.customerCopy && !settings.kitchenCopy) throw new Error('فعّل نسخة العميل أو المطبخ في الإعدادات');
    SunmiPrinter = await preparePrinter();
    const kinds: Array<'customer' | 'kitchen'> = [];
    if (settings.customerCopy) kinds.push('customer');
    if (settings.kitchenCopy) kinds.push('kitchen');
    const copies = Math.min(5, Math.max(1, Math.floor(settings.copies)));
    for (let copy = 0; copy < copies; copy++) {
      for (const kind of kinds) {
        // Stream commands directly. Waiting for native print callbacks while
        // still inside an uncommitted transaction can block before its commit.
        for (const line of buildReceipt(order, settings, kind, reprintReason)) {
          await printLine(SunmiPrinter, line.text, line.size, line.alignment);
        }
        const printer = SunmiPrinter;
        await printerStep('محاذاة رمز الفاتورة', () => printer.setAlignment('center'));
        await printerStep('طباعة رمز الفاتورة', () => printer.printQRCode(`RAWABI-ORDER:${order.id}`, settings.paperWidth === 80 ? 6 : 4, 'middle'));
        await printerStep('إخراج ورق الفاتورة', () => printer.lineWrap(4));
      }
    }
    return true;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.error('[SunmiPrinter] Error printing:', e);
    return false;
  } finally {
    busy = false;
  }
};

export const printTest = async (): Promise<boolean> => {
  if (busy) {
    lastError = 'الطابعة مشغولة. انتظر انتهاء الفاتورة الحالية';
    return false;
  }
  busy = true;
  lastError = null;
  try {
    const SunmiPrinter = await preparePrinter();
    await printLine(SunmiPrinter, 'اختبار الطباعة', 30, 'center');
    await printLine(SunmiPrinter, 'الطابعة متصلة وجاهزة', 24, 'center');
    await printerStep('إخراج ورقة الاختبار', () => SunmiPrinter.lineWrap(4));
    return true;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.error('[SunmiPrinter] Error testing print:', e);
    return false;
  } finally {
    busy = false;
  }
};
