// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow bundling the shared outputs that live OUTSIDE this project:
//   tenbagger/data/*.json            (pipeline + lessons generator)
//   tenbagger/packages/screener/     (screener engine)
// so switching src/data/sources.ts / src/lib/screener.ts to them is a one-line change.
const extra = ['../data', '../packages']
  .map((p) => path.resolve(__dirname, p))
  .filter((p) => fs.existsSync(p));
config.watchFolders = [...(config.watchFolders ?? []), ...extra];

module.exports = config;
