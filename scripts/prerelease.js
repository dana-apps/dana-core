const { writeFileSync } = require('fs');

const filepath = require.resolve('../src/app/electron/release.ts');
const releaseDate = JSON.stringify(new Date().toISOString());

writeFileSync(filepath, `export const RELEASE_DATE = ${releaseDate}`);
