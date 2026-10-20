const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '..');
const target = process.argv[2] && path.resolve(process.argv[2]);
if (!target || target === source || target.startsWith(source + path.sep)) {
  throw new Error('An isolated destination outside the source project is required');
}
if (fs.existsSync(target)) throw new Error('Destination already exists');
fs.mkdirSync(target, { recursive: true });
// Allow-list: no credentials, previous APKs, workspace config, or sibling apps.
for (const name of ['app', 'assets', 'components', 'constants', 'contexts', 'hooks', 'lib', 'app.json', 'metro.config.js', 'tsconfig.json', 'expo-env.d.ts']) {
  const from = path.join(source, name);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(target, name), { recursive: true });
}
const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json')));
const versions = require('./native-build.versions.json');
for (const section of ['dependencies', 'devDependencies']) {
  for (const name of Object.keys(pkg[section] || {})) {
    if (!versions[name]) throw new Error('Missing native-build pin: ' + name);
    pkg[section][name] = versions[name];
  }
}
pkg.name = 'sunmi-order-printer-native';
pkg.private = true;
pkg.scripts = {};
pkg.pnpm = { overrides: {
  '@react-native/codegen': versions['react-native'],
  '@react-native/babel-plugin-codegen': versions['react-native'],
} };
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
// Native generation uses the existing static identity; no private device key is
// embedded. The merchant signs in via the existing dashboard session API.
const config = JSON.parse(fs.readFileSync(path.join(target, 'app.json')));
if (config.expo.android.package !== 'com.standalone.sunmiorderprinter') throw new Error('Wrong Android package');
console.log('Prepared isolated Sunmi native build with React Native', versions['react-native']);
