const path = require('path');
const { devDependencies } = require('../package.json');

const toPath = (_path) => path.join(process.cwd(), _path);

module.exports = {
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions'
  ],
  features: {
    // Optional, for fastest build
    storyStoreV7: true
  },
  framework: '@storybook/react',
  // Storybook is using an old version of emotion (v10), which conflicts with the one we use (v11). This prevents the
  // app theme from being passed through react context to stories.
  //
  // Pin the version of emotion here so that the same instance is used throughout.
  webpackFinal: async (config) => {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          '@emotion/core': toPath('node_modules/@emotion/react'),
          '@emotion/styled': toPath('node_modules/@emotion/styled'),
          'emotion-theming': toPath('node_modules/@emotion/react'),
          '@babel/preset-react': toPath('node_modules/@babel/preset-react')
        }
      }
    };
  }
};
