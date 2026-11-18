const { getDefaultConfig } = require("expo/metro-config");
const { realpathSync } = require("node:fs");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
// Support a local dependency cache outside an iCloud-managed checkout.
const modules = path.join(__dirname, "node_modules");
const resolvedModules = realpathSync(modules);
if (resolvedModules !== modules)
  config.watchFolders = [...config.watchFolders, resolvedModules];
// Shared, dependency-free packages (e.g. packages/workout-core) live outside
// this app; let Metro watch and bundle them.
config.watchFolders = [
  ...config.watchFolders,
  path.resolve(__dirname, "../../packages"),
];
module.exports = config;
