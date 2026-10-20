// Isolated contract/receipt/native-adapter regression tests. No real network,
// credentials, database writes, or attached printer are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function load(relative, dependencies, globals = {}) {
  const filename = path.join(root, relative);
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputText, {
    exports: module.exports, module,
    require(name) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected dependency ${name}`);
    },
    console, setTimeout, clearTimeout, URL, AbortController, ...globals,
  }, { filename });
  return module.exports;
}

async function run() {
  const order = {
    id: '41', dailyNumber: 8, customerName: 'عميل اختبار', customerPhone: '0500000000',
    customerAddress: 'عنوان اختبار', orderType: 'delivery', status: 'preparing',
    items: [{ id: 'c1', name: 'مندي', quantity: 2, price: 2200, customization: {
      size: 'نصف', riceType: 'بشاور', selectedOptions: [{ groupName: 'صلصة', choice: 'حار' }],
    } }],
    createdAt: new Date().toISOString(), paymentMethod: 'cash', totalPrice: 4900,
    deliveryFee: 500, discountAmount: 0, notes: 'بدون بصل', driverName: 'مندوب اختبار',
  };
  const settings = {
    storeName: 'روابي المندي', paperWidth: 58, copies: 2,
    customerCopy: true, kitchenCopy: true,
  };
  const receipt = load('lib/receipt.ts', {});
  const orderActions = load('lib/order-actions.ts', {});
  const seen = [{ type: 'order', orderId: order.id }];
  assert.equal(orderActions.needsAcceptance({ ...order, status: 'pending' }, [], []), true);
  assert.equal(orderActions.needsAcceptance({ ...order, status: 'out_for_delivery' }, [], seen), true);
  assert.equal(orderActions.needsAcceptance({ ...order, status: 'out_for_delivery' }, [{ kind: 'accepted', orderId: order.id }], seen), false);
  assert.equal(orderActions.needsAcceptance({ ...order, status: 'cancelled' }, [], seen), false);
  assert.equal(orderActions.needsAcceptance({ ...order, status: 'done' }, [], seen), false);
  const customer = receipt.buildReceipt(order, settings, 'customer');
  const kitchen = receipt.buildReceipt(order, settings, 'kitchen');
  const text = customer.map(line => line.text).join('\n');
  assert(text.includes('49.00 ر.س'));
  assert(text.includes('44.00 ر.س'));
  assert(text.includes('الضريبة غير متاح'));
  assert(text.includes('صلصة: حار'));
  assert(text.includes('مندوب اختبار'));
  assert(!kitchen.some(line => line.text.includes('49.00')));
  assert(receipt.buildReceipt(order, settings, 'customer', 'طلب العميل').some(line => line.text === 'إعادة طباعة'));

  const calls = [];
  const apiModule = load('lib/api.ts', {
    'expo-constants': { default: { expoConfig: { extra: {} } } },
  }, {
    __DEV__: false,
    process: { env: { EXPO_PUBLIC_API_BASE_URL: 'https://terminal.invalid' } },
    fetch: async (url, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ url, method: options.method ?? 'GET', body });
      let data;
      if (url.endsWith('/api/orders')) data = [{ ...order, id: 41 }];
      else if (url.endsWith('/api/menu') && options.method === 'POST') data = { itemId: 'new-item', name: 'صنف', price: 2200, available: true };
      else if (url.endsWith('/api/menu/new-item')) data = { itemId: 'new-item', name: 'صنف', price: 2200, available: false };
      else if (url.endsWith('/api/menu/c1')) data = {
        itemId: 'c1', name: 'مندي', price: Math.round(body.price * 100),
        sizes: body.sizes.map(size => ({ ...size, price: Math.round(size.price * 100) })),
        available: true,
      };
      else if (url.endsWith('/api/orders/41/assign-driver')) data = { driverId: body.driverId, status: 'assigned' };
      else if (url.includes('/messages/order/')) data = [
        { id: 1, driverId: null, text: 'رسالة العميل' },
        { id: 2, driverId: 9, text: 'محادثة المندوب' },
      ];
      else throw new Error(`Unexpected request ${url}`);
      return { ok: true, text: async () => JSON.stringify(data) };
    },
  });
  assert.equal((await apiModule.api.getAllOrders())[0].id, '41');
  const created = await apiModule.api.createMenuItem({ name: 'صنف', category: 'chicken', price: 22, available: false });
  assert.equal(created.id, 'new-item');
  assert.equal(created.available, false);
  assert.equal(calls.find(call => call.method === 'POST').body.price, 22);
  assert.equal(calls.filter(call => call.method === 'PUT').length, 1);
  assert.equal((await apiModule.api.getMessages('41')).length, 1);
  const updated = await apiModule.api.updateMenuItem('c1', {
    price: 22, sizes: [{ name: 'نصف', price: 22, available: true }],
  });
  assert.equal(updated.price, 2200, 'Existing API converts SAR input to minor units');
  assert.equal(updated.sizes[0].price, 2200);
  await apiModule.api.assignDriver('41', '9');
  const assignmentRequest = calls.find(call => call.url.endsWith('/api/orders/41/assign-driver'));
  assert.equal(assignmentRequest.body.driverId, 9);
  await assert.rejects(apiModule.api.assignDriver('41', 'invalid'), /غير صالح/);

  const saved = [];
  const stateValues = [
    { ...settings, autoPrint: true, keepAwake: true, soundEnabled: true },
    { events: [], actions: [] }, true, 0, null,
  ];
  let stateIndex = 0;
  let refIndex = 0;
  const react = {
    createElement: (type, props) => ({ type, props }),
    createContext: () => ({ Provider: 'Provider' }),
    useCallback: fn => fn,
    useEffect: () => {},
    useState: () => [stateValues[stateIndex++], () => {}],
    useRef: value => ({ current: refIndex++ === 0 ? stateValues[0] : value }),
  };
  const terminal = load('lib/TerminalContext.tsx', {
    react: { __esModule: true, default: react, ...react },
    'react-native': { AppState: {}, ActivityIndicator: 'spinner', Pressable: 'button', Text: 'text', View: 'view' },
    expo: { requireOptionalNativeModule: () => null },
    '@tanstack/react-query': {
      useQueryClient: () => ({}),
      useQuery: () => ({ data: [], isSuccess: true, isError: false, dataUpdatedAt: 1 }),
      focusManager: {},
    },
    './AuthContext': { useAuth: () => ({ user: { id: 1 } }) },
    './api': { api: {} }, './printer': {}, './sound': {}, './order-actions': orderActions,
    './storage': { saveSettings: async value => saved.push(value) },
  });
  const runtime = terminal.TerminalProvider({ children: null }).props.value;
  await runtime.updateSettings({ autoPrint: false });
  assert.equal(saved.at(-1).autoPrint, false, 'Missing keep-awake module must not block unrelated settings');
  await Promise.all([
    runtime.updateSettings({ soundEnabled: false }),
    runtime.updateSettings({ copies: 3 }),
  ]);
  assert.equal(saved.at(-1).soundEnabled, false);
  assert.equal(saved.at(-1).copies, 3, 'Concurrent settings updates must merge');
  await assert.rejects(runtime.updateSettings({ keepAwake: true }), /غير متوفرة/);

  let committed = 0;
  let qrs = 0;
  let nativeLoads = 0;
  const native = new Proxy({}, { get(_target, name) {
    if (name === 'then') return undefined;
    if (name === 'prepare') return async () => true;
    if (name === 'exitPrinterBuffer') return async commit => { if (commit) committed++; };
    if (name === 'printQRCode') return async () => { qrs++; };
    return async () => {};
  } });
  const printer = load('lib/printer.ts', {
    'react-native': { Platform: { OS: 'android' } },
    './storage': { getSettings: async () => settings },
    './receipt': receipt,
    '@mitsuharu/react-native-sunmi-printer-library': new Proxy(native, { get(target, key) { nativeLoads++; return target[key]; } }),
  });
  assert.equal(nativeLoads, 0, 'Native SDK must not load at module import/startup');
  assert.equal(await printer.printOrder(order), true);
  assert.equal(committed, 0, 'Direct printing must not depend on buffered transaction callbacks');
  assert.equal(qrs, 4);
  assert.equal(await printer.printTest(), true);

  const fastTimers = {
    setTimeout: callback => setTimeout(callback, 0),
    clearTimeout,
  };
  let resolvePrepare;
  let recovering = false;
  let textCalls = 0;
  const stalledNative = new Proxy({}, { get(_target, name) {
    if (name === 'then') return undefined;
    if (name === 'prepare') return () => recovering
      ? Promise.resolve(true) : new Promise(resolve => { resolvePrepare = resolve; });
    if (name === 'enterPrinterBuffer' || name === 'exitPrinterBuffer') {
      return () => { throw new Error('Buffered printing must not be used'); };
    }
    if (name === 'printText') return async () => { textCalls++; };
    return async () => {};
  } });
  const stalledPrinter = load('lib/printer.ts', {
    'react-native': { Platform: { OS: 'android' } },
    './storage': { getSettings: async () => settings },
    './receipt': receipt,
    '@mitsuharu/react-native-sunmi-printer-library': stalledNative,
  }, fastTimers);
  assert.equal(await stalledPrinter.printOrder(order), false, 'A missing native callback must not hold the lock forever');
  assert.match(stalledPrinter.getLastPrinterError(), /الاتصال وتهيئة/);
  assert.match(stalledPrinter.getLastPrinterError(), /مهلة/);
  resolvePrepare(true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(textCalls, 0, 'A late callback must not restart a timed-out receipt');
  recovering = true;
  assert.equal(await stalledPrinter.printOrder(order), true, 'The print lock must be released after timeout');
  assert(textCalls > 0);
  assert.equal(await stalledPrinter.printTest(), true, 'Diagnostics must remain usable after a timeout');

  let stallText = true;
  const stalledTextPrinter = load('lib/printer.ts', {
    'react-native': { Platform: { OS: 'android' } },
    './storage': { getSettings: async () => settings },
    './receipt': receipt,
    '@mitsuharu/react-native-sunmi-printer-library': new Proxy(stalledNative, { get(target, name) {
      if (name === 'printText' && stallText) return () => new Promise(() => {});
      return target[name];
    } }),
  }, fastTimers);
  assert.equal(await stalledTextPrinter.printTest(), false);
  assert.match(stalledTextPrinter.getLastPrinterError(), /طباعة سطر/);
  stallText = false;
  assert.equal(await stalledTextPrinter.printTest(), true, 'A stalled print command must also release the lock');

  const unavailable = load('lib/printer.ts', {
    'react-native': { Platform: { OS: 'web' } }, './storage': { getSettings: async () => settings }, './receipt': receipt,
  });
  assert.equal(await unavailable.printOrder(order), false);
  assert(unavailable.getLastPrinterError().includes('Android'));
  let plays = 0;
  let stops = 0;
  let audioOptions;
  let audioMode;
  let released = 0;
  let lockScreenActive = false;
  const sound = load('lib/sound.ts', {
    'expo-haptics': { notificationAsync: async () => {}, NotificationFeedbackType: { Warning: 1 } },
    'react-native': { Vibration: { vibrate() {}, cancel() {} } },
    './storage': { getSettings: async () => ({ soundEnabled: false }) },
    '../assets/audio/alert.wav': 1,
    'expo-audio': {
      setAudioModeAsync: async options => { audioMode = options; },
      createAudioPlayer: () => {
        audioOptions = {
          play: () => { plays++; },
          pause: () => { stops++; },
          remove: () => { released++; },
          setActiveForLockScreen: active => { lockScreenActive = active; },
        };
        return audioOptions;
      },
    },
  }, { setInterval: () => 1, clearInterval: () => {} });
  await sound.startAlert({ force: true });
  await sound.startAlert({ force: true });
  assert.equal(plays, 1, 'One repeating alarm, no overlapping sound objects');
  assert.equal(audioOptions.volume, 1);
  assert.equal(audioOptions.loop, true);
  assert.equal(audioOptions.muted, false);
  assert.equal(audioMode.interruptionMode, 'doNotMix');
  assert.equal(audioMode.shouldPlayInBackground, true);
  assert.equal(audioMode.shouldRouteThroughEarpiece, false);
  assert.equal(lockScreenActive, true);
  await sound.stopAlert();
  assert.equal(stops, 1);
  assert.equal(released, 1);
  assert.equal(lockScreenActive, false);
  await sound.startAlert();
  assert.equal(plays, 1, 'Legacy optional alerts still respect their preference');
  const missingNativePrinter = load('lib/printer.ts', {
    'react-native': { Platform: { OS: 'android' } },
    './storage': { getSettings: async () => settings },
    './receipt': receipt,
    console: { error() {} },
  });
  assert.equal(missingNativePrinter.getLastPrinterError(), null, 'Loading the app must not load the native printer');
  assert.equal(await missingNativePrinter.printTest(), false);
  assert.match(missingNativePrinter.getLastPrinterError(), /يمكنك استخدام التطبيق دون طباعة/);

  let registeredFallback;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'index.js'), 'utf8'), {
    require(name) {
      if (name === 'react') return { createElement: (component, props) => ({ component, props }) };
      if (name === 'expo') return { registerRootComponent: component => { registeredFallback = component; } };
      if (name === 'expo-router/entry') throw new Error('Simulated startup import failure');
      if (name === './components/StartupErrorScreen') return { StartupErrorScreen: 'safe-native-error-screen' };
      throw new Error('Unexpected bootstrap dependency');
    },
    Error, console: { error() {} },
  });
  assert.equal(registeredFallback().component, 'safe-native-error-screen');
  assert.match(registeredFallback().props.error.message, /Simulated startup import failure/);
  console.log('PASS: terminal contracts, receipts, mandatory alarm, lazy missing-printer recovery, and startup-import error screen.');
}
const watchdog = setTimeout(() => {
  console.error('FAIL: terminal tests did not finish');
  process.exit(1);
}, 10000);
run().then(() => clearTimeout(watchdog)).catch(error => {
  clearTimeout(watchdog);
  console.error(error);
  process.exit(1);
});
