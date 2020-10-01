#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'fs';
import g2js from 'gradle-to-js/lib/parser';
import path from 'path';
import plist from 'plist';
import yargs from 'yargs';
import { versionStringToVersion, versionToVersionCode } from './versionUtils';

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

display({ argv });

const paths = {
  androidManifest: './android/app/src/main/AndroidManifest.xml',
  buildGradle: './android/app/build.gradle',
  infoPlist: './ios/<APP_NAME>/Info.plist',
  packageJson: './package.json',
};

/**
 *
 * @param {string} versionText
 * @param {string} pathToPackage path to package.json
 * @returns {Object} contents of the package.json of the current directory
 */
function setPackageVersion(versionText, pathToPackage = paths.packageJson) {
  let packageJSON = null;
  try {
    packageJSON = JSON.parse(fs.readFileSync(pathToPackage));
    display(chalk.yellow(`Will set package version to ${chalk.bold.underline(versionText)}`));
    packageJSON.version = versionText;
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
 * @param {string} versionText version
 * @param {string} plistPath path to plist
 */
function getIOSVersionInfo(versionText, plistPath) {
  let versionInfo = {
    currentVersionCode: null,
    currentVersion: null,
    version: null,
    versionCode: null,
  };

  try {
    const plistInfo = plist.parse(fs.readFileSync(plistPath, 'utf8'));
    const currentVersion = versionStringToVersion(plistInfo.CFBundleShortVersionString);
    const versionCodeParts = plistInfo.CFBundleVersion.toString().split('.');
    const currentVersionCode = +(versionCodeParts[versionCodeParts.length - 1]);
    const version = versionStringToVersion(versionText, currentVersion, currentVersionCode);
    versionInfo = {
      currentVersionCode,
      currentVersion,
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
 * @param {string} versionText version
 * @param {string} plistPath path to plist
 */
function setIOSApplicationVersion(versionText, plistPath) {
  const { version } = getIOSVersionInfo(versionText, plistPath);
  const bundleVersion = `${version.major}.${version.minor}.${version.patch}.${version.build}`;
  if (version) {
    display(`\n${chalk.yellow('IOS version info:')}\n${version}\n`);
    display(chalk.yellow(`Will set CFBundleShortVersionString to ${chalk.bold.underline(versionText)}`));
    display(chalk.yellow(`Will set CFBundleVersion to ${chalk.bold.underline(bundleVersion)}`));
    try {
      const plistInfo = plist.parse(fs.readFileSync(plistPath, 'utf8'));
      plistInfo.CFBundleShortVersionString = versionText;
      plistInfo.CFBundleVersion = bundleVersion;
      fs.writeFileSync(plistPath, plist.build(plistInfo), 'utf8');
      display(chalk.green(`Version replaced in ${chalk.bold('Info.plist')}`));
    } catch (err) {
      display(chalk.yellowBright(`${chalk.bold.underline('WARNING:')} Cannot find file with name ${path.resolve(plistPath)}. This file will be skipped`));
    }
  }
}

async function getAndroidVersionInfo(versionText) {
  let versionInfo = {
    currentVersionCode: null,
    currentVersion: null,
    version: null,
    versionCode: null,
  };
  try {
    const gradle = await g2js.parseFile(paths.buildGradle);
    const currentVersion = versionStringToVersion(gradle.android.defaultConfig.versionName);
    const currentVersionCode = +(gradle.android.defaultConfig.versionCode);
    const version = versionStringToVersion(versionText, currentVersion, currentVersionCode);
    versionInfo = {
      currentVersionCode,
      currentVersion,
      version,
      versionCode: versionToVersionCode(version),
    };
  } catch (err) {
    display(chalk.yellowBright(`${chalk.bold.underline('WARNING:')} Cannot find attribute versionCode in file ${path.resolve(paths.buildGradle)}. Android version configuration will be skipped`));
  }
  return versionInfo;
}

async function setAndroidApplicationVersion(versionText) {
  const { version, versionCode } = await getAndroidVersionInfo(versionText);

  if (versionCode) {
    display(chalk.yellow(`\nAndroid version info:\n${version}\n`));
    display(chalk.yellow(`Will set Android version to ${chalk.bold.underline(versionText)}`));
    display(chalk.yellow(`Will set Android version code to ${chalk.bold.underline(versionCode)}`));
    try {
      const buildGradle = fs.readFileSync(paths.buildGradle, 'utf8');
      const newBuildGradle = buildGradle.replace(/versionCode \d+/g, `versionCode ${versionCode}`)
        .replace(/versionName "[^"]*"/g, `versionName "${versionText}"`);

      fs.writeFileSync(paths.buildGradle, newBuildGradle, 'utf8');
      display(chalk.green(`Version replaced in ${chalk.bold('build.gradle')}`));
    } catch (err) {
      display(chalk.yellowBright(`${chalk.bold.underline('WARNING:')} Cannot find file with name ${path.resolve(paths.buildGradle)}. This file will be skipped`));
    }

    try {
      const androidManifest = fs.readFileSync(paths.androidManifest, 'utf8');
      if (androidManifest.includes('android:versionCode') || androidManifest.includes('android:versionName')) {
        const newAndroidManifest = androidManifest.replace(/android:versionCode="\d*"/g, `android:versionCode="${versionCode}"`)
          .replace(/android:versionName="[^"]*"/g, `android:versionName="${versionText}"`);

        fs.writeFileSync(paths.androidManifest, newAndroidManifest, 'utf8');
        display(chalk.green(`Version replaced in ${chalk.bold('AndroidManifest.xml')}`));
      }
    } catch (err) {
      display(chalk.yellowBright(`${chalk.bold.underline('WARNING:')} Cannot find file with name ${path.resolve(paths.androidManifest)}. This file will be skipped`));
    }
  }
}

const changeVersion = async () => {
  const versionText = argv?.version || process.argv[2];
  const appName = setPackageVersion(versionText).name;
  const plistPaths = argv?.plistPaths || [paths.infoPlist.replace('<APP_NAME>', appName)];

  display(plistPaths);
  const plistPromises = plistPaths
    .map(plistPath => setIOSApplicationVersion(versionText, plistPath));
  await Promise.all(...plistPromises);
  await setAndroidApplicationVersion(versionText);

  display('');
};

changeVersion();
