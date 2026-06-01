// Expo's default Metro config, extended to keep Metro's file watcher out of the
// platform-managed `.local/` directory. That tree (notably
// `.local/state/workflow-logs/`) rotates files constantly; when Metro's
// fallback watcher (no watchman in this environment) crawls it during startup it
// can hit an ENOENT on a just-deleted log file and crash the whole bundler.
// Adding it to `resolver.blockList` removes it from the file map and the watch.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const ignoreLocal = /(^|[/\\])\.local([/\\]|$)/;
const existing = config.resolver.blockList;
config.resolver.blockList = !existing
  ? ignoreLocal
  : Array.isArray(existing)
    ? [...existing, ignoreLocal]
    : [existing, ignoreLocal];

module.exports = config;
