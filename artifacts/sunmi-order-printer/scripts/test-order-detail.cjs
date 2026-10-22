// Offline component tests: no API, database, native printer or APK build.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const orderFixture = (extra = {}) => ({
  id: '41', dailyNumber: 8, customerName: 'عميل الاختبار',
  customerPhone: '0500000000', customerAddress: 'عنوان اختبار',
  orderType: 'delivery', status: 'pending', createdAt: '2026-10-22T00:00:00Z',
  items: [{ id: 'meal', name: 'مندي', quantity: 2, price: 2200 }],
  paymentMethod: 'cash', totalPrice: 4900, deliveryFee: 500,
  discountAmount: 0, notes: '', ...extra,
});

function harness(initialOrder = orderFixture()) {
  const slots = [];
  const effects = [];
  const timers = new Map();
  const alerts = [];
  const calls = [];
  const queries = [];
  const mutations = new Set();
  const printed = new Set();
  const queryState = { drivers: {}, assignment: {} };
  let cursor = 0, timerId = 0, currentTree, mounted = true;
  let props = { order: initialOrder, onClose: () => calls.push(['close']) };
  const drivers = [
    { id: '9', name: 'سائق متصل', active: true, isOnline: true, phone: '0500000001' },
    { id: '10', name: 'سائق غير متصل', active: true, isOnline: false, phone: '0500000002' },
  ];
  let assignment = null;
  const api = {
    getDrivers: async () => drivers,
    getAssignment: async () => assignment,
  };
  const terminal = {
    orders: [], actions: [],
    needsAcceptance: o => o.status === 'pending',
    print: async o => { calls.push(['print', o.id]); printed.add(o.id); },
    accept: async (o, minutes) => {
      calls.push(['accept', o.id, minutes]);
      terminal.orders = [{ ...o, status: 'preparing' }];
    },
    reject: async o => { calls.push(['reject', o.id]); },
    setStatus: async (o, status) => { calls.push(['status', o.id, status]); },
    recordDriverAssignment: async (o, id, name) => {
      calls.push(['assign', o.id, id]);
      assignment = { driver: { id, name }, assignment: { status: 'assigned' } };
    },
  };
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((x, i) => x !== b[i]);
  const react = {
    Fragment: 'Fragment',
    createElement(type, p, ...children) {
      return { type, props: { ...p, ...(children.length ? { children: children.length === 1 ? children[0] : children } : {}) } };
    },
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => {
        slots[i].value = typeof value === 'function' ? value(slots[i].value) : value;
      }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(fn, deps) {
      const i = cursor++;
      const previous = slots[i];
      if (!previous || changed(previous.deps, deps)) {
        slots[i] = { deps, cleanup: previous?.cleanup };
        effects.push(() => {
          previous?.cleanup?.();
          if (mounted) slots[i].cleanup = fn();
        });
      }
    },
    useCallback(fn) { return fn; },
    useMemo(fn) { return fn(); },
  };
  const ui = Object.fromEntries(
    ['Btn', 'Card', 'Chip', 'Field', 'Notice', 'Sheet', 'Txt', 'Skeleton', 'Empty', 'ErrorState']
      .map(name => [name, name]),
  );
  Object.assign(ui, {
    ROW: 'row-reverse', INK: '#1F2A37', GOLD_SOFT: '#FBF3DC',
    T: { body: {}, h2: {}, small: {} },
    errMsg: e => e instanceof Error ? e.message : String(e),
    dateOf: s => s, payLabel: s => s,
  });
  const dependencies = {
    react: { __esModule: true, default: react, ...react },
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable',
      ScrollView: 'ScrollView', Modal: 'Modal', ActivityIndicator: 'ActivityIndicator',
      KeyboardAvoidingView: 'KeyboardAvoidingView',
      Platform: { OS: 'android' }, I18nManager: { isRTL: true },
      StyleSheet: { create: s => s, absoluteFillObject: {} },
      Alert: { alert: (...args) => alerts.push(args) },
      useWindowDimensions: () => ({ width: 320, height: 640 }),
    },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
    },
    '@tanstack/react-query': {
      useQueryClient: () => ({
        invalidateQueries: async key => calls.push(['invalidate', key.queryKey]),
        setQueryData: (_key, value) => { assignment = value; },
      }),
      useQuery: options => {
        queries.push(options);
        const isDrivers = options.queryKey[0] === 'drivers';
        const data = isDrivers ? drivers : assignment;
        return {
          data, isSuccess: true, isLoading: false, isPending: false,
          isFetching: false, isError: false, error: null,
          refetch: async () => ({ data }),
          ...queryState[isDrivers ? 'drivers' : 'assignment'],
        };
      },
      useMutation: options => {
        const i = cursor++;
        if (!slots[i]) slots[i] = { isPending: false };
        const slot = slots[i];
        const mutateAsync = async (value, callbacks) => {
          slot.isPending = true;
          try {
            const result = await options.mutationFn(value);
            await options.onSuccess?.(result, value);
            await callbacks?.onSuccess?.(result, value);
            return result;
          } catch (error) {
            await options.onError?.(error, value);
            await callbacks?.onError?.(error, value);
            throw error;
          } finally {
            slot.isPending = false;
            await options.onSettled?.();
          }
        };
        return {
          isPending: slot.isPending, mutateAsync, reset: () => {},
          mutate: (value, callbacks) => {
            const task = mutateAsync(value, callbacks).catch(() => {}).finally(() => mutations.delete(task));
            mutations.add(task);
          },
        };
      },
    },
    '../lib/api': { api },
    '../lib/format': { formatMoney: v => `${v / 100} ر.س` },
    '../lib/TerminalContext': { useTerminal: () => terminal },
    '../lib/storage': { getPrintedOrderIds: async () => [...printed] },
    '../hooks/useColors': {
      useColors: () => ({
        primary: '#B58E3F', foreground: '#1F2A37', mutedForeground: '#68707C',
        card: '#FFFFFF', border: '#E5E7EB', background: '#F5F5F5',
        success: '#19734B', successForeground: '#FFFFFF',
        destructive: '#DC2626', destructiveForeground: '#FFFFFF', muted: '#F1F1F1',
      }),
    },
    './ui': ui,
    './StatusBadge': { StatusBadge: 'StatusBadge' },
    './Conversation': { Conversation: 'Conversation' },
  };
  const globals = {
    Error, console,
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => fn(),
  };
  const modules = new Map();
  function load(relative) {
    if (modules.has(relative)) return modules.get(relative);
    const filename = path.join(root, relative);
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.React, esModuleInterop: true,
      },
    });
    const module = { exports: {} };
    vm.runInNewContext(outputText, {
      module, exports: module.exports, ...globals,
      require(name) {
        if (name in dependencies) return dependencies[name];
        if (name === '../lib/print-timeout') return load('lib/print-timeout.ts');
        if (name === './OrderDetailSheet') return load('components/OrderDetailSheet.tsx');
        if (name === './OrderDetailOverlays') return load('components/OrderDetailOverlays.tsx');
        throw new Error(`Unexpected component dependency: ${name}`);
      },
    }, { filename });
    modules.set(relative, module.exports);
    return module.exports;
  }
  const component = load('components/OrderDetail.tsx').OrderDetail;
  function render() {
    cursor = 0;
    currentTree = component(props);
    while (effects.length) effects.shift()();
    return currentTree;
  }
  async function flush() {
    for (let i = 0; i < 25; i++) {
      await Promise.resolve();
      render();
    }
    return currentTree;
  }
  function* walk(node) {
    if (node == null || typeof node === 'boolean') return;
    if (Array.isArray(node)) { for (const child of node) yield* walk(child); return; }
    if (typeof node !== 'object') { yield node; return; }
    yield node;
    if (node.props?.visible === false) return;
    if (typeof node.type === 'function') {
      yield* walk(node.type(node.props));
      return;
    }
    for (const [key, value] of Object.entries(node.props ?? {})) {
      if (['children', 'footer', 'header', 'status', 'badge', 'overlay', 'action'].includes(key)) yield* walk(value);
    }
  }
  const find = predicate => [...walk(currentTree)].find(node => typeof node === 'object' && predicate(node));
  const byId = id => find(node => node.props?.testID === id);
  const text = () => [...walk(currentTree)].filter(value => typeof value === 'string').join(' ');
  render();
  // Process initial identity-reset state before interacting.
  render();
  return {
    terminal, printed, calls, alerts, drivers, timers, queries, queryState,
    storage: dependencies['../lib/storage'],
    render, flush, find, byId, text, load, react,
    get tree() { return currentTree; },
    setOrder(order) { props = { ...props, order }; render(); render(); },
    setReadOnly(readOnly) { props = { ...props, readOnly }; render(); },
    setAssignment(value) { assignment = value; render(); },
    unmount() {
      mounted = false;
      for (const slot of slots) slot?.cleanup?.();
    },
    expireToasts() {
      for (const [id, task] of [...timers]) {
        if (task.delay >= 2000 && task.delay <= 5000) { timers.delete(id); task.fn(); }
      }
      render();
    },
  };
}

async function run() {
  // Flow assertions below exercise the real component handlers, with only the
  // platform, hooks, network and native printer replaced by offline doubles.
  const named = (h, name) => h.find(n => n.type?.name === name);
  const count = (h, kind) => h.calls.filter(call => call[0] === kind).length;
  const click = (h, id) => {
    const button = h.byId(id);
    assert(button, `Missing action ${id}`);
    assert(!button.props.disabled && !button.props.loading, `Action ${id} is disabled`);
    return button.props.onPress();
  };

  {
    const h = harness();
    const job = deferred();
    h.terminal.print = async o => {
      h.calls.push(['print', o.id]);
      await job.promise;
      h.printed.add(o.id);
    };
    const accept = h.byId('accept-order').props.onPress;
    accept(); accept();
    await h.flush();
    assert.equal(count(h, 'print'), 1, 'Rapid acceptance taps must not print twice');
    assert.equal(count(h, 'accept'), 0, 'Wait for receipt submission before accepting');
    assert.equal(named(h, 'DriverPicker').props.visible, false);
    assert.equal(h.byId('chat-customer').props.disabled, true);
    job.resolve();
    await h.flush();
    assert.equal(count(h, 'accept'), 1);
    assert.deepEqual(h.calls.filter(([k]) => ['print', 'accept'].includes(k)).map(([k]) => k), ['print', 'accept']);
    assert.equal(named(h, 'DriverPicker').props.visible, true);
    assert.equal(h.find(n => n.type === 'StatusBadge').props.status, 'preparing');
    assert(h.text().includes('اختر السائق'));
    assert(h.byId('assign-driver-9'));
    assert.equal(h.byId('assign-driver-10').props.disabled, true);
    click(h, 'skip-driver-assignment');
    await h.flush();
    assert.equal(named(h, 'DriverPicker').props.visible, false);
    assert.equal(count(h, 'assign'), 0);
    assert.equal(count(h, 'close'), 0, 'Skip must return to the same order');
    for (const label of ['الطلب', 'السائق', 'المحادثة']) {
      assert(!h.find(n => n.type === 'Chip' && n.props.label === label), 'Old detail tabs must be gone');
    }
    assert(!h.find(n => n.type === 'Notice' && /لم يسند سائق لهذا الطلب بعد/.test(n.props.text)));
    h.unmount();
  }
  {
    const h = harness();
    h.printed.add('41');
    click(h, 'accept-order');
    await h.flush();
    assert.equal(count(h, 'print'), 0, 'Existing printed history must prevent acceptance reprints');
    assert.equal(count(h, 'accept'), 1);
    assert.equal(named(h, 'DriverPicker').props.visible, true);
    h.unmount();
  }
  {
    const h = harness(orderFixture({ orderType: 'pickup' }));
    click(h, 'accept-order');
    await h.flush();
    assert.equal(count(h, 'print'), 1);
    assert.equal(count(h, 'accept'), 1);
    assert.equal(named(h, 'DriverPicker').props.visible, false, 'Pickup never requires a driver');
    assert(!h.byId('open-driver-picker'));
    h.unmount();
  }
  {
    const h = harness();
    h.terminal.print = async () => { throw new Error('نفد الورق'); };
    click(h, 'accept-order');
    await h.flush();
    assert.equal(count(h, 'accept'), 0, 'Print failure must not advance the acceptance flow');
    assert.equal(named(h, 'DriverPicker').props.visible, false);
    assert(h.find(n => n.type === 'Notice' && n.props.text === 'نفد الورق'));
    assert.equal(h.alerts.length, 1, 'Real printer failures remain visible even after scrolling');
    assert(!h.byId('order-detail-toast'));
    assert.equal(h.byId('accept-order').props.disabled, false, 'UI lock releases on failure');
    h.unmount();
  }
  {
    const h = harness();
    h.terminal.accept = async () => { throw new Error('انقطع اتصال الخادم'); };
    click(h, 'accept-order');
    await h.flush();
    assert.equal(named(h, 'DriverPicker').props.visible, false, 'Acceptance failure is not successful acceptance');
    assert.equal(count(h, 'print'), 1);
    h.terminal.accept = async o => h.calls.push(['accept', o.id]);
    click(h, 'accept-order');
    await h.flush();
    assert.equal(count(h, 'print'), 1, 'Retry acceptance after an API error must not print again');
    assert.equal(named(h, 'DriverPicker').props.visible, true);
    h.unmount();
  }
  {
    const h = harness();
    h.storage.getPrintedOrderIds = () => new Promise(() => {});
    click(h, 'accept-order');
    await h.flush();
    const timeout = [...h.timers.values()].find(timer => timer.delay === 3000);
    assert(timeout, 'History lookup needs a finite UI wait');
    timeout.fn();
    await h.flush();
    assert.equal(count(h, 'print'), 0);
    assert.equal(count(h, 'accept'), 0);
    assert(h.find(n => n.type === 'Notice' && /سجل الطباعة/.test(n.props.text)));
    assert.equal(h.byId('accept-order').props.disabled, false);
    h.unmount();
  }
  for (const message of [
    'انتظر انتهاء الطباعة الحالية',
    'توجد محاولة طباعة جارية؛ المرحلة الحالية: جلب اسم المندوب.',
    'توجد طباعة جارية؛ المرحلة الحالية: إرسال الفاتورة. لا تكرر المحاولة قبل انتهائها.',
  ]) {
    const h = harness();
    h.terminal.print = async () => { throw new Error(message); };
    click(h, 'print-invoice');
    await h.flush();
    assert(h.byId('order-detail-toast'), 'Busy errors must show a temporary toast');
    assert.equal(h.alerts.length, 0, 'Busy printing must not open a blocking alert');
    assert(!h.find(n => n.type === 'Notice'), 'Busy printing must not leave a permanent warning card');
    h.expireToasts();
    assert(!h.byId('order-detail-toast'));
    h.unmount();
  }
  {
    const h = harness();
    h.terminal.print = async () => { throw new Error('أُرسلت الفاتورة للطابعة لكن تعذر حفظ سجلها. لا تكرر الطباعة تلقائيًا.'); };
    click(h, 'print-invoice');
    await h.flush();
    assert(!h.byId('order-detail-toast'), 'An uncertain receipt is not an ordinary busy error');
    assert.equal(h.alerts.length, 1);
    assert(h.find(n => n.type === 'Notice' && /تعذر حفظ سجلها/.test(n.props.text)));
    h.unmount();
  }
  {
    const h = harness();
    click(h, 'open-driver-picker');
    await h.flush();
    click(h, 'assign-driver-9');
    await h.flush();
    assert.equal(count(h, 'assign'), 1, 'First assignment needs no reassignment dialog');
    assert.equal(named(h, 'DriverPicker').props.visible, false);
    assert(h.text().includes('سائق متصل'));
    assert.equal(h.byId('open-driver-picker').props.label, 'تغيير');
    h.unmount();
  }
  {
    const h = harness(orderFixture({ status: 'done' }));
    h.setAssignment({ driver: { id: '11', name: 'السائق السابق' }, assignment: { status: 'assigned' } });
    click(h, 'open-driver-picker');
    await h.flush();
    assert(h.byId('driver-change-dialog'), 'Change opens a compact dialog immediately');
    assert.equal(h.byId('confirm-driver-change').props.disabled, true, 'Choose a replacement before confirming');
    click(h, 'select-replacement-9');
    await h.flush();
    assert(h.byId('driver-change-dialog'));
    assert.equal(count(h, 'assign'), 0, 'Selecting a replacement must not immediately reassign');
    assert(h.text().includes('دون إعادة فتح الطلب أو تغيير حالته'));
    click(h, 'cancel-driver-change');
    await h.flush();
    assert.equal(count(h, 'assign'), 0);
    assert(!h.byId('driver-change-dialog'));
    assert.equal(named(h, 'DriverPicker').props.visible, false);
    click(h, 'open-driver-picker');
    await h.flush();
    click(h, 'select-replacement-9');
    await h.flush();
    const confirm = h.byId('confirm-driver-change').props.onPress;
    confirm(); confirm();
    await h.flush();
    assert.equal(count(h, 'assign'), 1, 'Double confirmation must not assign twice');
    assert.equal(count(h, 'status'), 0, 'Changing a driver must not reopen a completed order');
    assert.equal(named(h, 'DriverPicker').props.visible, false);
    h.unmount();
  }
  {
    const h = harness();
    h.terminal.recordDriverAssignment = async () => { throw new Error('تعذر إسناد السائق'); };
    click(h, 'open-driver-picker');
    await h.flush();
    click(h, 'assign-driver-9');
    await h.flush();
    assert.equal(named(h, 'DriverPicker').props.visible, true);
    assert.equal(named(h, 'DriverPicker').props.assignError, 'تعذر إسناد السائق');
    assert.equal(h.byId('assign-driver-9').props.disabled, false, 'Assignment failure must permit retry');
    named(h, 'DriverPicker').props.onAssign(h.drivers[1]);
    await h.flush();
    assert.equal(count(h, 'assign'), 0, 'Offline drivers cannot be assigned even through a stale handler');
    h.unmount();
  }
  {
    const h = harness();
    h.queryState.assignment.isPending = true;
    click(h, 'open-driver-picker');
    await h.flush();
    assert.equal(named(h, 'DriverPicker').props.loading, true);
    assert(!h.byId('assign-driver-9'), 'Wait for current assignment before allowing replacement');
    named(h, 'DriverPicker').props.onAssign(h.drivers[0]);
    await h.flush();
    assert.equal(count(h, 'assign'), 0);
    h.queryState.assignment.isPending = false;
    h.queryState.assignment.isError = true;
    h.queryState.assignment.error = new Error('تعذر تحميل السائق الحالي');
    await h.flush();
    assert(h.find(n => n.type === 'ErrorState' && /السائق الحالي/.test(n.props.message)));
    assert(!h.byId('assign-driver-9'), 'Unknown current driver must not bypass reassignment confirmation');
    h.unmount();
  }
  {
    const h = harness();
    click(h, 'chat-customer');
    await h.flush();
    assert.equal(named(h, 'ConversationSheet').props.visible, true);
    assert.equal(h.find(n => n.type === 'Conversation').props.orderId, '41');
    named(h, 'ConversationSheet').props.onClose();
    await h.flush();
    assert.equal(named(h, 'ConversationSheet').props.visible, false);
    assert(h.byId('print-invoice'));
    h.unmount();
  }
  for (const status of ['pending', 'preparing', 'ready', 'out_for_delivery', 'done', 'cancelled']) {
    const h = harness(orderFixture({ status }));
    h.setReadOnly(true);
    assert(!h.byId('accept-order'));
    click(h, 'print-invoice');
    await h.flush();
    assert.equal(count(h, 'print'), 1, `Invoice remains available for ${status}`);
    assert(h.byId('open-driver-picker'), 'Historical delivery assignment remains reachable');
    h.unmount();
  }
  {
    const h = harness();
    const oldJob = deferred(), newJob = deferred();
    h.terminal.print = async o => {
      h.calls.push(['print', o.id]);
      await (o.id === '41' ? oldJob.promise : newJob.promise);
      h.printed.add(o.id);
    };
    click(h, 'accept-order');
    await h.flush();
    h.setOrder(orderFixture({ id: '42', dailyNumber: 9 }));
    click(h, 'accept-order');
    await h.flush();
    oldJob.resolve();
    await h.flush();
    assert.equal(count(h, 'accept'), 0, 'Old order continuation must not accept after switching orders');
    assert.equal(h.byId('print-invoice').props.disabled, true, 'Old finally must not unlock a newer operation');
    assert.equal(named(h, 'DriverPicker').props.visible, false);
    newJob.resolve();
    await h.flush();
    assert.equal(count(h, 'accept'), 1);
    assert.equal(h.calls.find(([kind]) => kind === 'accept')[1], '42');
    assert.equal(named(h, 'DriverPicker').props.visible, true);
    h.unmount();
  }
  {
    const h = harness();
    const job = deferred();
    h.terminal.print = () => job.promise;
    click(h, 'accept-order');
    await h.flush();
    click(h, 'sheet-close');
    job.resolve();
    await h.flush();
    assert.equal(count(h, 'accept'), 0, 'Closing cancels the remaining UI sequence, not native work');
    assert.equal(named(h, 'DriverPicker').props.visible, false);
    assert.equal(count(h, 'close'), 1);
    h.unmount();
  }
  {
    const h = harness();
    h.terminal.print = async () => { throw new Error('انتظر انتهاء الطباعة الحالية'); };
    click(h, 'print-invoice');
    await h.flush();
    assert(h.timers.size > 0);
    h.setOrder(orderFixture({ id: '42' }));
    assert.equal(h.timers.size, 0, 'Changing orders clears toast timers');
    assert(!h.byId('order-detail-toast'));
    click(h, 'print-invoice');
    await h.flush();
    h.unmount();
    assert.equal(h.timers.size, 0, 'Unmount clears toast timers');
  }
  console.log('PASS: single-page order details; print/accept/driver sequence; no duplicate taps or acceptance reprints; pickup and history; assignment confirmation/cancel/retry; busy toast; genuine failures; stale-order and timer cleanup.');
}

if (require.main === module) {
  run().catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { harness, deferred, orderFixture, run };
