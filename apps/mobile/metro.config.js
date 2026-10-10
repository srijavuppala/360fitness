const { getDefaultConfig } = require("expo/metro-config");
const { realpathSync } = require("node:fs");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
// Support a local dependency cache outside an iCloud-managed checkout.
const modules = path.join(__dirname, "node_modules");
const resolvedModules = realpathSync(modules);
if (resolvedModules !== modules)
  config.watchFolders = [...config.watchFolders, resolvedModules];
module.exports = config;
