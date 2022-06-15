module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      require.resolve('./src/test/file-mock.ts'),
    '\\.(css|scss)$': require.resolve('./src/test/file-mock.ts')
  },
  testPathIgnorePatterns: [
    '<rootDir>/lib/',
    '/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/dist/'
  ]
};
