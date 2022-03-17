#!/usr/bin/env node

const { createServer, build, createLogger } = require('vite');
const { writeFile } = require('fs/promises');
const electronPath = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');

/** @type 'production' | 'development'' */
const mode = (process.env.MODE = process.env.MODE || 'development');

/** @type {import('vite').LogLevel} */
const LOG_LEVEL = 'info';

/** @type {import('vite').InlineConfig} */
const sharedConfig = {
  mode,
  build: {
    watch: {}
  },
  logLevel: LOG_LEVEL
};

/** Messages on stderr that match any of the contained patterns will be stripped from output */
const stderrFilterPatterns = [
  // warning about devtools extension
  // https://github.com/cawa-93/vite-electron-builder/issues/492
  // https://github.com/MarshallOfSound/electron-devtools-installer/issues/143
  /ExtensionLoadWarning/
];

/**
 * @param {{name: string; configFile: string; writeBundle: import('rollup').OutputPlugin['writeBundle'] }} param0
 */
const getWatcher = ({ name, configFile, writeBundle }) => {
  return build({
    ...sharedConfig,
    configFile,
    plugins: [{ name, writeBundle }]
  });
};

/**
 * Start or restart App when source files are changed
 * @param {{config: {server: import('vite').ResolvedServerOptions}}} ResolvedServerOptions
 */
const setupMainPackageWatcher = ({ config: { server } }) => {
  // Create VITE_DEV_SERVER_URL environment variable to pass it to the main process.
  {
    const protocol = server.https ? 'https:' : 'http:';
    const host = server.host || 'localhost';
    const port = server.port; // Vite searches for and occupies the first free port: 3000, 3001, 3002 and so on
    const path = '/';
    process.env.VITE_DEV_SERVER_URL = `${protocol}//${host}:${port}${path}`;
  }

  const logger = createLogger(LOG_LEVEL, {
    prefix: '[main]'
  });

  /** @type {ChildProcessWithoutNullStreams | null} */
  let spawnProcess = null;

  return getWatcher({
    name: 'reload-app-on-main-package-change',
    configFile: 'vite.electron.config.js',
    writeBundle() {
      if (spawnProcess !== null) {
        spawnProcess.off('exit', process.exit);
        spawnProcess.kill('SIGINT');
        spawnProcess = null;
      }

      spawnProcess = spawn(String(electronPath), [
        '.',
        '--no-sandbox',
        '--remote-debugging-port=9223'
      ]);

      spawnProcess.stdout.on(
        'data',
        (d) =>
          d.toString().trim() && logger.warn(d.toString(), { timestamp: true })
      );
      spawnProcess.stderr.on('data', (d) => {
        const data = d.toString().trim();
        if (!data) return;
        const mayIgnore = stderrFilterPatterns.some((r) => r.test(data));
        if (mayIgnore) return;
        logger.error(data, { timestamp: true });
      });

      // Stops the watch script when the application has been quit
      spawnProcess.on('exit', process.exit);
    }
  });
};

/**
 * Returns versions of electron vendors
 * The performance of this feature is very poor and can be improved
 * @see https://github.com/electron/electron/issues/28006
 *
 * @returns {NodeJS.ProcessVersions}
 */
function getVendors() {
  const output = execSync(
    `${electronPath} -p "JSON.stringify(process.versions)"`,
    {
      env: { ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf-8'
    }
  );

  return JSON.parse(output);
}

function updateVendors() {
  const electronRelease = getVendors();

  const nodeMajorVersion = electronRelease.node.split('.')[0];
  const chromeMajorVersion = electronRelease.v8
    .split('.')
    .splice(0, 2)
    .join('');

  const browserslistrcPath = path.resolve(process.cwd(), '.browserslistrc');

  return Promise.all([
    writeFile(
      './.electron-vendors.cache.json',
      JSON.stringify(
        {
          chrome: chromeMajorVersion,
          node: nodeMajorVersion
        },
        null,
        2
      ) + '\n'
    ),

    writeFile(browserslistrcPath, `Chrome ${chromeMajorVersion}\n`, 'utf8')
  ]);
}

(async () => {
  updateVendors();
  const viteDevServer = await createServer({
    ...sharedConfig,
    configFile: 'vite.renderer.config.js'
  });

  await viteDevServer.listen();

  await setupMainPackageWatcher(viteDevServer);
})();
