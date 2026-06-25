// Metro config monorepo-aware: in un workspace pnpm/hoisted i moduli stanno
// alla root, quindi Metro deve "guardare" anche lì.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Osserva tutti i file del monorepo (per il Fast Refresh sui pacchetti condivisi).
// Merge with Expo defaults so expo-doctor stays happy and built-in watch folders
// are preserved.
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

// 2. Risolvi i moduli sia dall'app sia dalla root del workspace.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
