/**
 *
 * @param {string} s
 * @returns {string}
 */
const trimText = (s) => {
  const indexOfString = s.search(/[^\d]/);
  let result = s;

  if (indexOfString > 0) {
    result = s.substring(0, indexOfString);
  }

  return result;
};

const versionEquals = (versionA, versionB) => (
  versionA.major === versionB.major
  && versionA.minor === versionB.minor
  && versionA.patch === versionB.patch
);

/**
 *
 * @param {string} versionString new version string
 */
const versionStringToVersion = (versionString) => {
  const versionParts = versionString.split('.');
  return {
    major: +trimText(versionParts[0] || '0'),
    minor: +trimText(versionParts[1] || '1'),
    patch: +trimText(versionParts[2] || '0'),
    build: +trimText(versionParts[3] || '1'),
  };
};

/**
 * Compares current and new versions to determine if the build number needs to be incremented
 * This returns the new versions with updated build number
 * @param {{major: number, minor: number, patch: number, build: number}} currentVersion
 * @param {{major: number, minor: number, patch: number, build: number}} newVersion
 * @throws if max build number has been exceeded
 * @returns {{major: number, minor: number, patch: number, build: number}}
 */
const updateVersionBuild = (currentVersion, newVersion, maxBuilds = 100) => {
  if (versionEquals(currentVersion, newVersion) && newVersion.build < currentVersion.build) {
    const newBuildNumber = currentVersion.build + 1;
    if (newBuildNumber >= maxBuilds) {
      throw new Error('Sorry you have more than 100 builds using that version consider bumping version or change your version manually');
    }
    return {
      ...newVersion,
      build: newBuildNumber,
    };
  }
  return newVersion;
};

/**
 * Creates a version code from android devices
 * @param {{major: number, minor: number, patch: number}} version
 */
const versionToVersionCode = (version) => {
  const major = version.major.toString().padStart(2, 0);
  const minor = version.minor.toString().padStart(2, 0);
  const patch = version.patch.toString().padStart(2, 0);
  const build = version.build.toString().padStart(2, 0);

  return +(`${major}${minor}${patch}${build}`);
};

module.exports = {
  updateVersionBuild,
  versionStringToVersion,
  versionToVersionCode,
};
