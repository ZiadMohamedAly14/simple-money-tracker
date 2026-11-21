const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// Expo's default config already handles the npm workspaces monorepo.
const config = getDefaultConfig(__dirname);

// SVGs import as React components (react-native-svg-transformer, configured by
// .svgrrc.js). NativeWind wraps the worker transformer, not this Babel one, so
// the two compose.
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = withNativeWind(config, { input: './global.css' });
