module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Il plugin worklets (Reanimated 4) DEVE essere l'ultimo della lista.
    plugins: ["react-native-worklets/plugin"],
  };
};
