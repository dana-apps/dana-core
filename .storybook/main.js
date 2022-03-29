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
  framework: '@storybook/react'
};
