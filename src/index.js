#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'fs';
import g2js from 'gradle-to-js/lib/parser';
import path from 'path';
import plist from 'plist';
import yargs from 'yargs';
import { updateVersionBuild, versionStringToVersion, versionToVersionCode } from './versionUtils';

const { argv } = yargs
  .option('plistPaths', {
    describe: 'Array of Paths to Info Plist',
    type: 'array',
  })
  .option('version', {
    alias: 'v',
    describe: 'the new version to update to',
    type: 'string',
  });

const display = console.log; // eslint-disable-line no-console

const paths = {
  androidManifest: './android/app/src/main/AndroidManifest.xml',
  buildGradle: './android/app/build.gradle',
  infoPlist: './ios/<APP_NAME>/Info.plist',
  packageJson: './package.json',
};

/**
 *
 * @param {string} versionString
 * @param {string} pathToPackage path to package.json
 * @returns {Object} contents of the package.json of the current directory
 */
function setPackageVersion(versionString, pathToPackage = paths.packageJson) {
  let packageJSON = null;
  try {
    packageJSON = JSON.parse(fs.readFileSync(pathToPackage));
    display(chalk.yellow(`Will set package version to ${chalk.bold.underline(versionString)}`));
    packageJSON.version = versionString;
    fs.writeFileSync(pathToPackage, `${JSON.stringify(packageJSON, null, 2)}\n`);
    display(chalk.green(`Version replaced in ${chalk.bold('package.json')}`));
  } catch (err) {
    display(chalk.red(`${chalk.bold.underline('ERROR:')} Cannot find file with name ${path.resolve(pathToPackage)}`));
    process.exit(1);
  }
  return packageJSON;
}

/**
 * Gets the current version info for iOS
 * @param {string} versionString version
 * @param {string} plistPath path to plist
 */
function getIOSVersionInfo(plistPath) {
  let versionInfo = {
    version: null,
    versionCode: null,
  };
  try {
    const plistInfo = plist.parse(fs.readFileSync(plistPath, 'utf8'));
    const version = versionStringToVersion(plistInfo.CFBundleVersion);
    versionInfo = {
      version,
      versionCode: version.build,
    };
  } catch (err) {
    display(chalk.yellowBright(`${chalk.bold.underline('WARNING:')} Cannot find key CFBundleShortVersionString in file ${path.resolve(paths.infoPlist)}. IOS version configuration will be skipped`));
  }
  return versionInfo;
}

/**
 * Set the current version info for iOS
 * @param {string} versionString version string
 * @param {{major: number, minor: number, patch: number}} version
 * @param {string} plistPath path to plist
 */
function setIOSApplicationVersion(versionString, version, plistPath) {
  const bundleVersion = `${version.major}.${version.minor}.${version.patch}.${version.build}`;
  if (version) {
    display(chalk.yellow(`Will set CFBundleShortVersionString to ${chalk.bold.underline(versionString)}`));
    display(chalk.yellow(`Will set CFBundleVersion to ${chalk.bold.underline(bundleVersion)}`));
    try {
      const plistInfo = plist.parse(fs.readFileSync(plistPath, 'utf8'));
      plistInfo.CFBundleShortVersionString = versionString;
      plistInfo.CFBundleVersion = bundleVersion;
      fs.writeFileSync(plistPath, plist.build(plistInfo), 'utf8');
      display(chalk.green(`Version replaced in ${chalk.bold('Info.plist')}`));
    } catch (err) {
      display(chalk.yellowBright(`${chalk.bold.underline('WARNING:')} Cannot find file with name ${path.resolve(plistPath)}. This file will be skipped`));
    }
  }
}

/**
 * Gets the current android version info
 * @param {string} versionString
 */
async function getAndroidVersionInfo() {
  let versionInfo = {
    version: null,
    versionCode: null,
  };
  try {
    const { android: { defaultConfig } } = await g2js.parseFile(paths.buildGradle);
    if (!defaultConfig.versionName && !defaultConfig.versionCode) {
      throw new Error(`Cannot find attribute versionCode or versionName in file ${path.resolve(paths.buildGradle)}`);
    }
    const version = versionStringToVersion(defaultConfig.versionName);
    const versionCode = +(defaultConfig.versionCode);
    versionInfo = {
      version,
      versionCode,
    };
  } catch (err) {
    display(chalk.yellowBright(`${chalk.bold.underline('WARNING:')} ${err}. Android version configuration will be skipped`));
  }
  return versionInfo;
}

function setAndroidApplicationVersion(version, versionCode) {
  const versionName = `${version.major}.${version.minor}.${version.patch}.${version.build}`;
  if (version) {
    display(chalk.yellow(`Will set Android version to ${chalk.bold.underline(versionName)}`));
    display(chalk.yellow(`Will set Android version code to ${chalk.bold.underline(versionCode)}`));
    try {
      const buildGradle = fs.readFileSync(paths.buildGradle, 'utf8');
      const newBuildGradle = buildGradle
        .replace(/versionCode \d+/g, `versionCode ${versionCode}`)
        .replace(/versionName "[^"]*"/g, `versionName "${versionName}"`);

      fs.writeFileSync(paths.buildGradle, newBuildGradle, 'utf8');
      display(chalk.green(`Version replaced in ${chalk.bold('build.gradle')}`));
    } catch (err) {
      display(chalk.yellowBright(`${chalk.bold.underline('WARNING:')} Cannot find file with name ${path.resolve(paths.buildGradle)}. This file will be skipped`));
    }

    try {
      const androidManifest = fs.readFileSync(paths.androidManifest, 'utf8');
      if (androidManifest.includes('android:versionCode') || androidManifest.includes('android:versionName')) {
        const newAndroidManifest = androidManifest
          .replace(/android:versionCode="\d*"/g, `android:versionCode="${versionCode}"`)
          .replace(/android:versionName="[^"]*"/g, `android:versionName="${versionName}"`);

        fs.writeFileSync(paths.androidManifest, newAndroidManifest, 'utf8');
        display(chalk.green(`Version replaced in ${chalk.bold('AndroidManifest.xml')}`));
      }
    } catch (err) {
      display(chalk.yellowBright(`${chalk.bold.underline('WARNING:')} Cannot find file with name ${path.resolve(paths.androidManifest)}. This file will be skipped`));
    }
  }
}

const updateIOSApplicationVersion = (versionString, plistPath) => {
  const currentVersionInfo = getIOSVersionInfo(plistPath);
  const version = updateVersionBuild(currentVersionInfo.version, versionStringToVersion(versionString));
  setIOSApplicationVersion(versionString, version, plistPath);
};

const updateAndroidApplicationVersion = async (versionString) => {
  const currentVersionInfo = await getAndroidVersionInfo();
  const newVersion = updateVersionBuild(currentVersionInfo.version, versionStringToVersion(versionString));
  setAndroidApplicationVersion(newVersion, versionToVersionCode(newVersion));
};

const changeVersion = async () => {
  const versionString = argv?.version || process.argv[2];
  const appName = setPackageVersion(versionString).name;
  const plistPaths = argv?.plistPaths || [paths.infoPlist.replace('<APP_NAME>', appName)];

  plistPaths.map(plistPath => updateIOSApplicationVersion(versionString, plistPath));

  await updateAndroidApplicationVersion(versionString);

  display('');
};

changeVersion();
