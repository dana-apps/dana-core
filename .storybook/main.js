const { devDependencies } = require('../package.json');

const bundledDevDependencies = new Set(['@faker-js/faker']);

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
  // core: {
  //   builder: 'storybook-builder-vite'
  // },
  async viteFinal(config, { configType }) {
    // customize the Vite config here
    config.resolve.alias ||= {};
    for (const key of Object.keys(devDependencies)) {
      if (!key.startsWith('@storybook/') && !bundledDevDependencies.has(key)) {
        config.resolve.alias[key] = require.resolve('./ignore.js');
      }
    }

    // return the customized config
    return config;
  }
};
