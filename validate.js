/* eslint-disable linebreak-style */
/* eslint-disable no-param-reassign */
/* eslint-disable dot-notation */
/* eslint-disable no-console */

const { toLower } = require('./convert');

/**
 * Validates the client_id parameter is the expected value.
 * @param {*} clientIdValue The value to validate.
 * @returns Boolean. Returns true if the parameter was a valid value, otherwise false.
 */
function isValidClientId(clientIdValue) {
  // SECURITY: Replace with stronger client id.  :)
  const clientIdPrefix = '3';
  return clientIdValue && clientIdValue.startsWith(clientIdPrefix);
}

/**
 * Validates the client_secret parameter is the expected value.
 * @param {*} clientSecretValue The value to validate.
 * @returns Boolean. Returns true if the parameter was a valid value, otherwise false.
 */
function isValidClientSecret(clientSecretValue) {
  // SECURITY: Replace with stronger client secret.  :)
  const clientSecretPrefix = 'T';
  return clientSecretValue && clientSecretValue.startsWith(clientSecretPrefix);
}

/**
 * Validates the redirect_uri parameter is the expected value.
 * @param {*} redirectUriValue The value to validate.
 * @returns Boolean. Returns true if the parameter was a valid value, otherwise false.
 */
function isValidRedirectUri(redirectUriValue) {
  // SECURITY: Replace with uri validation rules.
  return redirectUriValue && toLower(redirectUriValue).startsWith('http');
}

/**
 * Validate the make parameter is an expected value.
 * @param {*} makeValue The value to validate.
 * @returns Boolean. Returns true if the parameter was a valid value, otherwise false.
 */
function isValidMake(makeValue) {
  if (makeValue === undefined) {
    return false;
  }

  makeValue = toLower(makeValue);
  return makeValue === 'f' || makeValue === 'ford' || makeValue === 'l' || makeValue === 'lincoln';
}

/**
 * Validate the year parameter is in the expected range.
 * @param {*} yearValue The value to validate.
 * @returns Boolean. Returns true if the parameter was a valid value, otherwise false.
 */
function isValidYear(yearValue) {
  const year = parseInt(yearValue, 10);
  return year >= 2010;
}

exports.isValidClientId = isValidClientId;
exports.isValidClientSecret = isValidClientSecret;
exports.isValidRedirectUri = isValidRedirectUri;
exports.isValidMake = isValidMake;
exports.isValidYear = isValidYear;
