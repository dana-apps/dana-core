/**
 * @type {import('vite').Options}
 */
module.exports = {
  entities: ['src/app/**/*.entity.ts'],
  migrations: {
    path: 'src/app/migrations'
  },
  dbName: ':memory:',
  type: 'sqlite'
};
