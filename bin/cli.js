#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */
const { program } = require('commander');
const { writeFile } = require('fs/promises');

const { version } = require('../package.json');
const { archives, collections, PageRangeAll } = require('../lib/lib');

program
  .command('dump-schema <archive> <destination>')
  .description('Export the schema of an archive to a json file')
  .action(async (archive, destination) => {
    console.log(archive, destination);
    const instance = await archives.openArchive(archive);
    if (instance.status !== 'ok') {
      throw Error(`Could not open ${archive}`);
    }

    const { items: schema } = await collections.allCollections(
      instance.value,
      PageRangeAll
    );
    await writeFile(destination, JSON.stringify(schema, undefined, 2));
    console.log('Wrote schema to', destination);

    await archives.closeArchive(archive);
  });

program
  .version(version)
  .description('CLI interface to Dana')
  .parse(process.argv);
