/**
 * SVGR options for react-native-svg-transformer. A config file replaces the
 * transformer's defaults, so its SVGO overrides are repeated here.
 * removeMetadata and removeUnusedNS strip the C2PA <metadata> blocks and the
 * xmlns:c2pa attribute the icon files carry, so they never reach the bundle.
 */
module.exports = {
  native: true,
  plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
  svgoConfig: {
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            inlineStyles: { onlyMatchedOnce: false },
            removeViewBox: false,
            removeUnknownsAndDefaults: false,
            convertColors: false,
          },
        },
      },
      'removeMetadata',
      'removeUnusedNS',
    ],
  },
};
