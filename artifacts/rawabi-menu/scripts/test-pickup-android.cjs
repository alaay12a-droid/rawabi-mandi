// Offline regression coverage for the branch picker; no API or order writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../components/BranchPickerModal.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  },
}).outputText;

function picker(os) {
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useMemo: fn => fn(),
    useRef: () => ({ current: null }),
    useEffect: () => {},
  };
  const native = {
    Platform: { OS: os }, Dimensions: { get: () => ({ height: 800 }) },
    I18nManager: { isRTL: true },
    StyleSheet: { create: value => value, absoluteFill: {} },
    Linking: { openURL: async () => {} }, Alert: { alert: () => {} },
  };
  for (const name of ["Modal", "View", "Text", "TouchableOpacity", "ScrollView", "Pressable", "StatusBar"]) native[name] = name;
  const dependencies = {
    react, "react-native": native,
    "react-native-maps": { __esModule: true, default: "NativeMap", Marker: "NativeMarker" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require: name => { if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`); return dependencies[name]; },
  });
  return module.exports.default;
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...tree.children.flatMap(nodes)];
}

const branch = { id: 1, name: "فرع الاختبار", address: "عنوان الفرع", mapsUrl: null, lat: 24.7, lng: 46.7, active: true };
let selected = null;
let confirmed = null;
let closed = false;
const props = {
  visible: true, branches: [branch], selected: null,
  onSelect: value => { selected = value; },
  onConfirm: value => { confirmed = value; },
  onClose: () => { closed = true; },
  colors: { background: "#fff", card: "#fff", foreground: "#111", mutedForeground: "#666", border: "#ddd", primary: "#E8920C", secondary: "#eee", gold: "#E8920C" },
  fontFamily: { regular: "regular", semi: "semi", bold: "bold" },
};
const AndroidPicker = picker("android");
let tree = AndroidPicker(props);
assert.equal(nodes(tree).filter(node => node.type === "NativeMap").length, 0, "Android branch selection must never mount a native map");
const buttons = nodes(tree).filter(node => node.type === "TouchableOpacity");
buttons.at(-1).props.onPress();
assert.equal(confirmed, null, "A branch must be selected before confirmation");
buttons[0].props.onPress();
assert.equal(selected, branch);
tree = AndroidPicker({ ...props, selected });
nodes(tree).filter(node => node.type === "TouchableOpacity").at(-1).props.onPress();
assert.equal(confirmed, branch, "Android pickup must confirm the selected branch without a map");
tree.props.onRequestClose();
assert.equal(closed, true, "Android back must dismiss branch selection");
assert.equal(nodes(AndroidPicker({ ...props, branches: [] })).filter(node => node.type === "NativeMap").length, 0);
assert.equal(nodes(picker("ios")(props)).filter(node => node.type === "NativeMap").length, 1, "Keep the existing iPhone map");
console.log("PASS: Android branch selection, confirmation, back, empty branches; iPhone map unchanged.");
