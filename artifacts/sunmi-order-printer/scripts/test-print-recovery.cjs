// Offline failure/recovery tests: no device, network, credentials or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const fastTimers = { setTimeout: fn => setTimeout(fn, 0), clearTimeout };

function load(relative, deps, globals = {}) {
  const filename = path.join(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports, console: { error() {} },
    setTimeout, clearTimeout, URL, AbortController, Error,
    require(name) {
      if (name === './print-timeout') return load('lib/print-timeout.ts', {}, globals);
      if (name in deps) return deps[name];
      throw Error(`Unexpected import ${name}`);
    }, ...globals,
  }, { filename });
  return module.exports;
}

const order = {
  id: '101', dailyNumber: 1, orderType: 'delivery', status: 'preparing',
  items: [], createdAt: '2026-01-01T00:00:00Z',
};
function terminal({ assignment = async () => null, record = async () => {}, send = async () => true } = {}) {
  const effects = [];
  const state = [
    { autoPrint: true, copies: 1, kitchenCopy: true, customerCopy: true },
    { events: [], actions: [] }, true, 0, null, false,
  ];
  let stateIndex = 0;
  const react = {
    createElement: (type, props) => ({ type, props }),
    createContext: () => ({ Provider: 'Provider' }),
    useCallback: fn => fn,
    useEffect: fn => effects.push(fn),
    useRef: value => ({ current: value }),
    useState() {
      const index = stateIndex++;
      return [state[index], value => { state[index] = value; }];
    },
  };
  const module = load('lib/TerminalContext.tsx', {
    react: { __esModule: true, default: react, ...react },
    'react-native': {},
    expo: { requireOptionalNativeModule: () => null },
    '@tanstack/react-query': {
      useQueryClient: () => ({}), focusManager: {},
      useQuery: () => ({ data: [order, { ...order, id: '102' }], isSuccess: true }),
    },
    './AuthContext': { useAuth: () => ({ user: { id: 1 } }) },
    './api': { api: { getAssignment: assignment } },
    './printer': { printOrder: send, getLastPrinterError: () => 'اختبار فشل اتصال Sunmi', getActivePrintStage: () => null },
    './sound': {}, './order-actions': load('lib/order-actions.ts', {}),
    './storage': {
      getPrintedOrderIds: async () => [], addPrintedOrderId: record,
      saveTerminalHistory: async () => {},
    },
  }, fastTimers);
  return { runtime: module.TerminalProvider({ children: null }).props.value, state, effects };
}

async function run() {
  let resolveAssignment;
  const sent = [];
  const lookupStall = terminal({
    assignment: () => new Promise(resolve => { resolveAssignment = resolve; }),
    send: async value => { sent.push(value); return true; },
  });
  await lookupStall.runtime.print(order);
  assert.equal(sent.length, 1, 'A stalled optional driver lookup must not prevent printing');
  resolveAssignment({ driver: { name: 'late result' } });
  await Promise.resolve();
  assert.equal(sent.length, 1, 'Late lookup must not submit another invoice');
  await lookupStall.runtime.print({ ...order, orderType: 'pickup' });
  assert.equal(sent.length, 2, 'Outer lock must release after lookup fallback');

  let stallRecord = true;
  const recording = terminal({ record: () => stallRecord ? new Promise(() => {}) : Promise.resolve() });
  await assert.rejects(recording.runtime.print(order), /أُرسلت الفاتورة.*حفظ سجلها/);
  assert.equal(recording.state[5], true, 'Uncertain history must pause automatic printing');
  stallRecord = false;
  await recording.runtime.print({ ...order, id: '103' });
  assert.equal(recording.state[5], false, 'Successful deliberate manual printing may resume auto printing');

  let attempts = 0;
  const automatic = terminal({ send: async () => { attempts++; return false; } });
  const drain = automatic.effects.find(fn => fn.toString().includes('getPrintedOrderIds'));
  assert(drain, 'Auto-print effect must exist');
  drain();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 1, 'Failure must not immediately start the next queued receipt');
  assert.equal(automatic.state[5], true);
  drain();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 1, 'Polling must not restart auto printing after a fault');

  let clock = 0;
  let advance = 60000;
  class ClockDate extends Date { static now() { return clock; } }
  const native = new Proxy({}, { get(_target, name) {
    if (name === 'then') return undefined;
    if (name === 'prepare') return async () => true;
    return async () => { clock += advance; };
  } });
  const printer = load('lib/printer.ts', {
    'react-native': { Platform: { OS: 'android' } },
    './storage': { getSettings: async () => ({ customerCopy: true, kitchenCopy: false, copies: 1 }) },
    './receipt': { buildReceipt: () => [{ text: 'first' }, { text: 'second' }] },
    '@mitsuharu/react-native-sunmi-printer-library': native,
  }, { ...fastTimers, Date: ClockDate });
  assert.equal(await printer.printOrder(order), false, 'Cumulative command time must have an overall bound');
  assert.match(printer.getLastPrinterError(), /المهلة الكلية/);
  assert.equal(printer.getActivePrintStage(), null);
  advance = 0;
  assert.equal(await printer.printTest(), true, 'The native lock must release after the total deadline');

  const api = load('lib/api.ts', {
    'expo-constants': { default: { expoConfig: { extra: {} } } },
  }, {
    ...fastTimers, __DEV__: false,
    process: { env: { EXPO_PUBLIC_API_BASE_URL: 'https://terminal.invalid' } },
    fetch: async (_url, options) => ({
      ok: true,
      text: () => new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted body'); error.name = 'AbortError'; reject(error);
        }, { once: true });
      }),
    }),
  });
  await assert.rejects(api.api.getAssignment('101'), /انتهت مهلة الاتصال/, 'Timeout must cover body reception, not only headers');
  console.log('PASS: driver lookup fallback, bounded print-history wait, auto-print fault pause, total native deadline, and stalled response body.');
}
module.exports = run;
if (require.main === module) {
  run().catch(error => { console.error(error); process.exitCode = 1; });
}
