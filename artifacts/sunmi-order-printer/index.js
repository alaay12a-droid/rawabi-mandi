// Keep module-evaluation failures separate from Android/native crashes.
// The latter must be diagnosed with logcat and cannot be caught by React.
const React = require('react');
const { registerRootComponent } = require('expo');

try {
  require('expo-router/entry');
} catch (error) {
  console.error('[Sunmi startup]', error);
  const { StartupErrorScreen } = require('./components/StartupErrorScreen');
  registerRootComponent(() => React.createElement(StartupErrorScreen, {
    error: error instanceof Error ? error : new Error(String(error)),
    resetError: () => {
      void require('expo').reloadAppAsync().catch(console.error);
    },
  }));
}
