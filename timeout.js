/* eslint-disable linebreak-style */
/* eslint-disable no-console */

// Duration that code & access token expire.
const timeoutInSeconds = parseInt(process.env.FORDSIM_TIMEOUT, 10) || 20 * 60;
const commandTimeoutInSeconds = parseInt(process.env.FORDSIM_CMDTIMEOUT, 10) || 120;
console.log(`timeout for code and access tokens set to ${timeoutInSeconds} seconds.`);
console.log(`timeout for commandIds set to ${commandTimeoutInSeconds} seconds.`);

/**
 * Gets the number of seconds an access token is good for.
 *
 * @returns number of seconds until access token times out.
 */
function getAccessTokenTimeout() {
  return timeoutInSeconds;
}

/**
 * Gets the number of seconds the oauth code is good for.
 *
 * @returns number of seconds until oath code times out.
 */
function getCodeTimeout() {
  return timeoutInSeconds;
}

/**
 * Gets the number of seconds a commandId is good for.
 *
 * @returns integer. number of seconds the commandId is good for.
 */
function getCommandTimeout() {
  return commandTimeoutInSeconds;
}

exports.getAccessTokenTimeout = getAccessTokenTimeout;
exports.getCodeTimeout = getCodeTimeout;
exports.getCommandTimeout = getCommandTimeout;
