/* eslint-disable linebreak-style */
/* eslint-disable no-param-reassign */
/* eslint-disable dot-notation */
/* eslint-disable no-console */

const { makeGuid } = require('./guid');
const { getAccessTokenTimeout } = require('./timeout');

const applicationId = 'afdc085b';

const tokens = [];

/**
 * Generates a new token and adds it to the token list.
 * @param {*} tokenKey The key to use (if undefined then auto-generated key will be created.)
 * @param {*} isRefresh Boolean. true for refresh tokens.
 */
function generateToken(tokenKey, isRefresh) {
  if (tokenKey === undefined || tokenKey.length < 1) {
    tokenKey = `${isRefresh ? 'REFRESH' : 'ACCESS'}-${makeGuid()}`;
  }
  const token = {
    key: tokenKey,
    isRefreshToken: !!(isRefresh),
    // 90 days for refresh, access tokens are significantly less (typically ~20 mins)
    expires: Date.now() + (isRefresh ? 90 * 86400 : getAccessTokenTimeout()) * 1000,
  };
  tokens.push(token);
  console.info(`Issued token: ${tokenKey}`);
  return token;
}

/**
 * Check if a value is a valid applicationId.
 *
 * @param {*} req The client request.
 * @returns Boolean. true if the id was valid.
 */
function isValidApplicationId(req) {
  const appId = req.headers['application-id'];
  return (appId !== undefined) && appId.startsWith(applicationId);
}

/**
 * Check if a value was a token.
 *
 * @param {*} tokenKey The key to search for.
 * @returns Boolean. true if the token was issued.
 */
function isToken(tokenKey) {
  return tokens.filter((t) => t.key === tokenKey
    && !t.isRefreshToken).length > 0;
}

/**
 * Check if a token is still valid.
 *
 * @param {*} tokenKey The key to validate against.
 * @returns Boolean. true is the token is still valid.
 */
function isValidToken(tokenKey) {
  return tokens.filter((t) => t.key === tokenKey
  && !t.isRefreshToken && Date.now() < t.expires).length !== 0;
}

/**
 * Check if a refresh token is still valid.
 *
 * @param {*} refreshTokenValue The key to validate against.
 * @returns Boolean. true is the refresh token is still valid.
 */
function isValidRefreshToken(refreshTokenValue) {
  return tokens.filter((t) => t.key === refreshTokenValue
  && t.isRefreshToken && Date.now() < t.expires).length !== 0;
}

if (process.env.FORDSIM_TOKEN) {
  generateToken(process.env.FORDSIM_TOKEN);
}

/**
 * Returns the access token from the request.  The request should have an authorization header
 * that contains the text "Bearer " followed by the access token for the API.  This token should
 * have been obtained via a call to the /oauth2/v2.0/token route.
 *
 * @param {*} req The request object.
 * @returns The user provided token for accessing the API, or "AUTH-BEARER-NOT-PROVIDED".
 */
function getTokenFromRequest(req) {
  // eslint-disable-next-line dot-notation
  let reqToken = req.headers['authorization'];
  if (reqToken && reqToken.startsWith('Bearer ')) {
    reqToken = reqToken.substring(7);
  } else {
    reqToken = 'AUTH-BEARER-NOT-PROVIDED';
  }

  return reqToken;
}

/**
 * Returns a boolean to indicate if the access token is expired.
 *
 * @param {*} req The request object.
 * @returns Returns true if the token is expired or invalid, otherwise false.
 */
function isTokenExpired(req) {
  const reqToken = getTokenFromRequest(req);
  if (!isToken(reqToken) && process.env.NODE_ENV !== 'test') {
    console.error('ERROR: The token does not match the expected value.');
    return true;
  }

  if (isValidToken(reqToken)) {
    // This should be the typical case, since client shouldn't use expired tokens.
    return false;
  }

  if (process.env.NODE_ENV !== 'test') {
    console.warn('WARN: The token has expired. Your client should look at expires_in or expires_on timestamp.');
  }
  return true;
}

exports.generateToken = generateToken;
exports.getTokenFromRequest = getTokenFromRequest;
exports.isValidApplicationId = isValidApplicationId;
exports.isTokenExpired = isTokenExpired;
exports.isValidRefreshToken = isValidRefreshToken;
exports.applicationId = applicationId;
