const { execSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

/**
 * Logs to the console
 */
const log = (msg) => console.log(`\n${msg}`); // eslint-disable-line no-console

/**
 * Exits the current process with an error code and message
 */
const exit = (msg) => {
  console.error(msg);
  process.exit(1);
};

/**
 * Executes the provided shell command and redirects stdout/stderr to the console
 */
const run = (cmd, cwd) =>
  execSync(cmd, { encoding: 'utf8', stdio: 'inherit', cwd });

/**
 * Determines the current operating system (one of ["mac", "windows", "linux"])
 */
const getPlatform = () => {
  switch (process.platform) {
    case 'darwin':
      return 'mac';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
};

/**
 * Returns the value for an environment variable (or `null` if it's not defined)
 */
const getEnv = (name) => process.env[name.toUpperCase()] || null;

/**
 * Sets the specified env variable if the value isn't empty
 */
const setEnv = (name, value) => {
  if (value) {
    process.env[name.toUpperCase()] = value.toString();
  }
};

/**
 * Installs NPM dependencies and builds/releases the Electron app
 */
const runAction = () => {
  const platform = getPlatform();
  const release = getEnv('release', true) === 'true';
  const pkgRoot = getEnv('package_root', true);
  const buildScriptName = getEnv('build_script_name', true);
  const skipBuild = getEnv('skip_build') === 'true';

  // TODO: Deprecated option, remove in v2.0. `electron-builder` always requires a `package.json` in
  // the same directory as the Electron app, so the `package_root` option should be used instead
  const appRoot = getEnv('app_root') || pkgRoot;

  const pkgJsonPath = join(pkgRoot, 'package.json');
  const pkgLockPath = join(pkgRoot, 'package-lock.json');

  // Determine whether NPM should be used to run commands (instead of Yarn, which is the default)
  log(`Will run NPM commands in directory "${pkgRoot}"`);

  // Make sure `package.json` file exists
  if (!existsSync(pkgJsonPath)) {
    exit(`\`package.json\` file not found at path "${pkgJsonPath}"`);
  }

  // Copy "github_token" input variable to "GH_TOKEN" env variable (required by `electron-builder`)
  setEnv('GH_TOKEN', getEnv('github_token', true));

  // Require code signing certificate and password if building for macOS. Export them to environment
  // variables (required by `electron-builder`)
  if (platform === 'mac') {
    setEnv('CSC_LINK', getEnv('mac_certs'));
    setEnv('CSC_KEY_PASSWORD', getEnv('mac_certs_password'));
  } else if (platform === 'windows') {
    setEnv('CSC_LINK', getEnv('windows_certs'));
    setEnv('CSC_KEY_PASSWORD', getEnv('windows_certs_password'));
  }

  // Disable console advertisements during install phase
  setEnv('ADBLOCK', true);

  log(`Installing dependencies using NPM…`);
  run('npm install', pkgRoot);

  // Run NPM build script if it exists
  if (skipBuild) {
    log('Skipping build script because `skip_build` option is set');
  } else {
    log('Running the build script…');
    run(`npm run ${buildScriptName} --if-present`, pkgRoot);
  }

  try {
    log(`Building${release ? ' and releasing' : ''} the Electron app…`);
    run(`npx electron-forge publish`, appRoot);
  } catch (err) {
    log(`Failed with an error, probably the "it already exists" one`);
    log(err.message);
  }
};

runAction();
