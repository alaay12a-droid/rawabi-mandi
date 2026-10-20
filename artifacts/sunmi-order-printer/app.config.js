const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    sunmiDeviceApiKey: process.env.SUNMI_DEVICE_API_KEY,
  },
};