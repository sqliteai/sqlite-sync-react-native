const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '../..');

/**
 * Metro configuration for monorepo
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  projectRoot: __dirname,
  watchFolders: [root],

  resolver: {
    unstable_enablePackageExports: true,

    // Ensure we only use one instance of react/react-native
    blockList: [
      // Exclude root node_modules to prevent duplicate React
      new RegExp(`${path.resolve(root, 'node_modules')}/react/.*`),
      new RegExp(`${path.resolve(root, 'node_modules')}/react-native/.*`),
    ],

    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
