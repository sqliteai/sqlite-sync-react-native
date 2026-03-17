const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const root = path.resolve(__dirname, '../..');
const rootNodeModules = path.join(root, 'node_modules');
const localNodeModules = path.join(__dirname, 'node_modules');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

config.projectRoot = __dirname;
config.watchFolders = [root];

config.resolver.nodeModulesPaths = [localNodeModules, rootNodeModules];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  '@sqliteai/sqlite-sync-react-native': root,
};

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
