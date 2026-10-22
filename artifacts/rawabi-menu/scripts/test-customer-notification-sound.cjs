// Offline regression checks: no devices, real tokens, API calls, or database writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

for (const file of ["app/(tabs)/orders.tsx", "app/(tabs)/more.tsx"]) {
  const source = read(file);
  assert.doesNotMatch(
    source,
    /useChatUnreadAlert|useChatSound|useAppSound|playAppSound|playUriSound|expo-av/,
    `${file}: loading unread counts must not play custom audio`,
  );
}
assert.match(read("app/(tabs)/orders.tsx"), /totalUnreadFromCashier/);
assert.match(read("app/(tabs)/more.tsx"), /unreadTotal/);
assert.match(read("app/(tabs)/orders.tsx"), /addNotificationReceivedListener/);
assert.match(read("app/_layout.tsx"), /registerCustomerNotifications\(\)/);
assert.match(read("app/cashier.tsx"), /useChatUnreadAlert\(totalUnread\)/);
assert.match(read("app/cashier.tsx"), /useChatUnreadAlert\(pendingCount\)/);

const compiled = ts.transpileModule(read("hooks/useCustomerPushToken.ts"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

function loadPush(os, granted = true) {
  const channels = [];
  const posts = [];
  let handler;
  let requested = false;
  const notifications = {
    AndroidImportance: { HIGH: 4 },
    setNotificationHandler: value => { handler = value; },
    getPermissionsAsync: async () => ({ status: granted ? "granted" : "denied" }),
    requestPermissionsAsync: async () => {
      requested = true;
      return { status: "denied" };
    },
    setNotificationChannelAsync: async (id, options) => { channels.push({ id, ...options }); },
    getExpoPushTokenAsync: async () => ({ data: "offline-test-token" }),
    getDevicePushTokenAsync: async () => ({ data: "offline-test-native-token" }),
  };
  const dependencies = {
    react: { useState: () => {}, useEffect: () => {} },
    "react-native": { Platform: { OS: os } },
    "expo-notifications": notifications,
    "@react-native-async-storage/async-storage": {
      getItem: async () => null,
      setItem: async () => {},
    },
    "@/constants/api": {
      apiPost: async (url, body) => { posts.push({ url, body }); },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: name => {
      if (!(name in dependencies)) throw new Error(`Unexpected native dependency: ${name}`);
      return dependencies[name];
    },
  });
  return {
    register: module.exports.registerCustomerNotifications,
    channels,
    posts,
    handler: () => handler,
    requested: () => requested,
  };
}

(async () => {
  for (const os of ["android", "ios"]) {
    const push = loadPush(os);
    const behavior = await push.handler().handleNotification();
    assert.equal(behavior.shouldPlaySound, true, `${os}: real notifications must remain audible`);
    assert.equal(behavior.shouldShowBanner, true);
    assert.equal(behavior.shouldSetBadge, true);
    assert.equal(await push.register(), "offline-test-token");
    assert(push.posts.some(post => post.url === "/push-tokens" && post.body.role === "customer"));
    if (os === "android") {
      assert.equal(push.channels.length, 1);
      assert.equal(push.channels[0].id, "order-status");
      assert.equal(push.channels[0].sound, "default");
    } else {
      assert.equal(push.channels.length, 0);
    }

    const denied = loadPush(os, false);
    assert.equal(await denied.register(), null);
    assert.equal(denied.requested(), true);
    assert.equal(denied.posts.length, 0);
    assert.equal(denied.channels.length, 0);
  }
  console.log("PASS: customer screens do not play custom unread-count sounds.");
  console.log("PASS: Android default sound, iOS foreground sound, badges, permissions, and cashier alerts preserved.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
