/**
 * @type {import('@mikro-orm/core').Options<import('@mikro-orm/sqlite').SqliteDriver>}
 */
module.exports = {
  entities: ['src/app/**/*.entity.ts'],
  migrations: {
    path: 'src/app/migrations'
  },
  discovery: {},
  dbName: 'tmp/migrations.sqlite',
  driverOptions: {
    dbName: ':memory:'
  },
  type: 'sqlite'
};
