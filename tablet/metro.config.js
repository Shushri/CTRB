const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude all native android source and compilation directories from being watched/resolved
config.resolver.blockList = [
  /node_modules\/.*\/android\/.*/,
  /android\/.*/,
  /.*\.expo-constants-.*\/android\/.*/
];

module.exports = config;
