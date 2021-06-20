/* eslint-disable linebreak-style */
/* eslint-disable no-param-reassign */
/* eslint-disable dot-notation */
/* eslint-disable no-console */

/**
 * FordConnect API Simulator.
 *
 * This simulator is only intended for use by someone that is already authorized by Ford to use
 * the FordConnect API, for example [Ford Smart Vehicle Connectivity Challenge]
 * (https://fordsmart.devpost.com/).  Please ensure you also test your application against the
 * FordConnect API provided by Ford; using a test VIN if needed.
 *
 * The purpose of this project is to simulate the API from FordConnect, while enabling the user
 * to test various scenarios without having to have a vehicle to perform the test scenarios. For
 * example, you can change the location of the vehicle, change fuel level, etc.  This simulator
 * is intented to run on your local development environment.  If your application cannot access
 * your local development environment, you make need to use ngrok.com to expose it on the internet.
 *
 * Error descriptions/messages are not idential to FordConnect server, but status codes should
 * match.
 *
 * The oauth2 route is slightly different than the FordConnect route, and it uses the server
 * provided value for the 'code' variable (not the one from the oauth2 redirect).
 *
 * Tokens expire after 20 minutes.
 *
 * Supported Environment Variables:
 *   FORDSIM_HTTPPORT = 80     (The HTTP port that the service will listen on.  Default = 80)
 *   FORDSIM_CODE = SomeCode   (Any special access code. Default = auto-generated code.)
 *   FORDSIM_TOKEN = SomeToken (Any special access token.  Default = auto-generated token.)
 *   FORDSIM_TIMEOUT = 1200  (Number of seconds before code + access token expire. Default = 1200)
 *   FORDSIM_CMDTIMEOUT = 120 (Number of seconds before commandId values expire. Default = 120)
 *
 * If you have a new mock vehicle, update vehicles.js with an additional export.
 *
 */

// Contributors to the simulator, please search for "TEST:", "REVIEW:", "TODO:" and "SECURITY:"
// comments & also look at issues at https://github.com/jamisonderek/ford-connect-sim/issues.

const express = require('express');
const http = require('http');
const formidable = require('express-formidable');
const path = require('path');
const timestamp = require('./timestamp');
const mockVehicles = require('./vehicles');

const app = express();

/**
 * Returns an object with extra properties about the vehicle.  Most of the properties can be
 * used to determine the current state of the vehicle.
 *
 * @param {*} full Name of large image image.
 * @param {*} thumbnail Name of thumbnail image.
 * @returns The extra property for the vehicle, or undefined.
 */
function makeExtra(full, thumbnail) {
  return {
    doorsLocked: true,
    doorsLockedTimestamp: timestamp.now(),
    alarmEnabled: false,
    alarmTimestamp: timestamp.now(),
    lastStarted: 0, // These are Date.now() values.
    lastStopped: 0,
    lastWake: 0,
    lastStartCharge: 0,
    lastStopCharge: 0,
    image: full === undefined ? 'full-image.png' : full,
    imageThumbnail: thumbnail === undefined ? 'thumbnail.png' : thumbnail,
  };
}

/**
 * Generates a GUID.  This implementation does not use a secure random generator.
 *
 * Modified from https://www.arungudelli.com/tutorial/javascript/how-to-create-uuid-guid-in-javascript-with-examples/
 * @returns a new GUID.
 */
function makeGuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // eslint-disable-next-line no-bitwise
    const r = Math.random() * 16 | 0;
    // eslint-disable-next-line no-mixed-operators, no-bitwise
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Duration that code & access token expire.
const timeoutInSeconds = parseInt(process.env.FORDSIM_TIMEOUT, 10) || 20 * 60;
const commandTimeoutInSeconds = parseInt(process.env.FORDSIM_CMDTIMEOUT, 10) || 120;
console.log(`timeout for code and access tokens set to ${timeoutInSeconds} seconds.`);
console.log(`timeout for commandIds set to ${commandTimeoutInSeconds} seconds.`);

// REVIEW: Should we refactor this code into vehicles.js?
const vehicles = [];
vehicles.push({
  vehicle: mockVehicles.ice1,
  info: mockVehicles.ice1_info,
  extra: makeExtra('full-image.png', 'thumbnail.png'),
});
// IMPORTANT: Put your list of test vehicles here.  See the README.md file for directions.
vehicles.push({
  vehicle: mockVehicles.ice2,
  info: undefined,
  extra: makeExtra('full-image.png', 'thumbnail.png'),
});
vehicles.push({
  vehicle: mockVehicles.ev1,
  info: mockVehicles.ev1_info,
  extra: makeExtra('full-image.png', 'thumbnail.png'),
  evdata: mockVehicles.ev1_evdata,
});

// This code is here just to enforce that the above code added at least 1 vehicle.
if (vehicles.length < 1) {
  console.error('ERROR: Please add at least 1 vehicle.');
  process.exit(1);
} else {
  console.log(vehicles);
}

// Track all of the commandId that were created via POST calls.
const commands = {
  unlock: [],
  lock: [],
  startEngine: [],
  stopEngine: [],
  wake: [],
  status: [],
  location: [],
  startCharge: [],
  stopCharge: [],
};

const httpPort = parseInt(process.env.FORDSIM_HTTPPORT, 10) || 80;

const httpServer = http.createServer(app);
if (process.env.NODE_ENV !== 'test') {
  console.log(`Listening on port ${httpPort}`);
  httpServer.listen(httpPort);
} else {
  console.log('WARNING: Environment set to "test" so not enabling listener.');
}

// We have POST data for our OAuth2 routes.  Use express-formidable middleware to parse.
app.use(formidable());

// The code is only good until the codeExpireTimestamp.
const code = process.env.FORDSIM_CODE || `Code${makeGuid()}`;
const codeExpireTimestamp = Date.now() + timeoutInSeconds * 1000;
console.log(`Code is: ${code}`);

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
    expires: Date.now() + (isRefresh ? 90 * 86400 : timeoutInSeconds) * 1000, // 90 days for refresh
  };
  tokens.push(token);
  console.info(`Issued token: ${tokenKey}`);
  return token;
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
 * Coverts to lowerCase, removing dotless i.
 *
 * @param {*} value A value to convert to lowercase.
 * @returns lowercased string.
 */
function toLower(value) {
  if (value !== undefined) {
    value = value.toLowerCase();
    // Convert dotless i to dotted i.
    value = value.replace('\u0131', 'i');
  }

  return value;
}

/**
 * Returns user controlled data for use in a JSON response.  In general, returning user controlled
 * data in your response is a bad idea from security perspective.  Always use this method when
 * returning user controlled data, so that the security review is easier.
 *
 * @param {*} value User controlled data.
 * @returns User controlled data.
 */
function reflectedUserInput(value) {
  // TEST: Does the FordConnect server escape the data?
  return value;
}

/**
 * Returns a deep copy of the item specified, so that any modifications will not impact the
 * original object.  NOTE: This does not handle copying properties that are set to undefined.
 *
 * @param {*} item The item to make a copy of.
 * @returns A copy of the item.
 */
function DeepCopy(item) {
  return JSON.parse(JSON.stringify(item));
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
  if (!isToken(reqToken)) {
    console.error('ERROR: The token does not match the expected value.');
    return true;
  }

  if (isValidToken(reqToken)) {
    // This should be the typical case, since client shouldn't use expired tokens.
    return false;
  }

  console.warn('WARN: The token has expired. Your client should look at expires_in or expires_on timestamp.');
  return true;
}

/**
 * Sends an HTTP 400 response that the vehicleId parameter was not the proper length.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @returns The res.json result.
 */
function sendBadVehicleIdLength(req, res) {
  res.statusCode = 400;
  return res.json({
    errorCode: '400',
    errorMessage: 'getVehicleV3.vehicleId: Invalid vehicleId, getVehicleV3.vehicleId: size must be between 32 and 32',
  });
}

/**
 * Sends an HTTP 400 response that the make parameter was not a valid value.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @returns The res.json result.
 */
function sendBadMakeParameter(req, res) {
  // REVIEW: FordConnect server currently returns 500 status code, but we are returning 400.
  res.statusCode = 400;
  return res.json({
    errorCode: '400',
    errorMessage: 'Invalid make parameter.  Must be one of: "F", "Ford", "L", "Lincoln".',
  });
}

/**
 * Sends an HTTP 400 response that the year parameter was not a valid value.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @returns The res.json result.
 */
function sendBadYearParameter(req, res) {
  // REVIEW: FordConnect currently returns 500 status code, but we are returning 400.
  res.statusCode = 400;
  return res.json({
    errorCode: '400',
    errorMessage: 'Invalid year parameter.  Must be four digit format (like 2019).',
  });
}

/**
 * Sends an HTTP 401 response that the access token is expired.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @returns The res.json result.
 */
function sendTokenExpiredJson(req, res) {
  res.statusCode = 401;
  return res.json({
    error: 'invalid_token',
    error_description: `Access token expired: ${reflectedUserInput(getTokenFromRequest(req))}`,
  });
}

/**
 * Sends an HTTP 401 response that the user is not authorized.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @param {*} commandId The commandId the user specified or undefined.
 * @returns The res.json result.
 */
function sendUnauthorizedUser(req, res, commandId) {
  res.statusCode = 401;
  const response = {
    error: {
      code: 3000,
      title: 'Unauthorized user',
      details: 'The user is unauthorized.',
      statusCode: 'UNAUTHORIZED',
    },
    status: 'FAILED',
    commandStatus: 'FAILED',
  };
  if (commandId !== undefined) {
    response.commandId = reflectedUserInput(commandId);
  }
  return res.json(response);
}

/**
 * Sends an HTTP 404 response that the resource was not found.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @returns The res.json result.
 */
function sendNotFound(req, res) {
  res.statusCode = 404;
  const response = {
    error: {
      code: 4002,
      title: 'Resource not found',
      details: 'The resource was not found.',
      statusCode: 'NOT_FOUND',
    },
    status: 'FAILED',
  };

  // TEST: Retest this logic.

  if (req.method === 'POST') {
    if (req.originalUrl.indexOf('Charge') > 0) {
      response.commandStatus = 'FAILED';
    } else {
      response.commandStatus = 'EMPTY';
    }
  } else {
    // eslint-disable-next-line no-lonely-if
    if (req.originalUrl.indexOf('/chargeSchedules') > 0) {
      response.chargeSchedules = null;
    } else if (req.originalUrl.indexOf('/departureTimes') > 0) {
      response.departureTimes = null;
    } else if (
      (req.originalUrl.indexOf('/unlock') > 0)
      || (req.originalUrl.indexOf('/lock') > 0)
      || (req.originalUrl.indexOf('/startEngine') > 0)
      || (req.originalUrl.indexOf('/stopEngine') > 0)) {
      response.commandStatus = 'EMPTY';
    }
  }

  return res.json(response);
}

/**
 * Sends an HTTP 401/406 response that the vehicle is not authorized.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @param {*} isPost Boolean. true if request is POST, false if GET.
 * @returns The res.json result.
 */
function sendVehicleNotAuthorized(req, res, isPost) {
  let response;
  if (isPost) {
    sendUnauthorizedUser(req, res, undefined);
  } else {
    res.statusCode = 406;
    response = {
      error: {
        code: 4006,
        title: 'Not Acceptable',
        details: 'Not acceptable',
        statusCode: 'NOT_ACCEPTABLE',
      },
      status: 'FAILED',
    };
  }

  return res.json(response);
}

/**
 * Sends an HTTP 406 response when a vehicleId does not have feature (like when issuing an
 * EV command to an ICE vehicle.)
 *
 * @param {*} req The request object.
 * @param {*} res The response ojbect.
 * @returns The res.json result.
 */
function sendUnsupportedVehicle(req, res) {
  res.statusCode = 406;
  return res.json({
    error: {
      code: 4006,
      title: 'Vehicle not supported for this command',
      details: 'Vehicle not supported for this command',
      statusCode: 'NOT_ACCEPTABLE',
    },
    status: 'FAILED',
    commandStatus: 'FAILED',
  });
}

/**
 * Updates the access token and refresh token. Sends a response with the new tokens.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @returns The res.json result.
 */
function sendRefreshTokenResponse(req, res) {
  const now = Date.now();

  console.log('Updating token');

  const token = generateToken();
  const refreshToken = generateToken(undefined, true);

  return res.json({
    access_token: token.key,
    id_token: 'eyJAAA==', // Stub - we don't use this.
    token_type: 'Bearer',
    not_before: Math.trunc(now / 1000),
    expires_in: timeoutInSeconds,
    expires_on: Math.trunc(token.expires / 1000),
    resource: 'c1e4c1a0-2878-4e6f-a308-836b34474ea9',
    id_token_expires_in: timeoutInSeconds,
    profile_info: 'ejyAAA==', // Stub - we don't use this.
    scope: 'https://simulated-environment.onmicrosoft.com/fordconnect/access openid offline_access',
    refresh_token: refreshToken.key,
    refresh_token_expires_in: 7776000, // 90 days.
  });
}

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

/**
 * Returns the vehicle object that has a vehicleId matching the vehicleId query parameter.  If no
 * matching vehicle is found, a JSON response will be sent using the response object and undefined
 * will be returned.
 *
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @returns The matching vehicle object from the glocal vehicles variable, or undefined if no match.
 */
function getVehicleOrSendError(req, res) {
  // TODO: Refactor this method so the caller doesn't need to return undefined.

  const { vehicleId } = req.params;
  if (!vehicleId || vehicleId.length !== 32) {
    sendBadVehicleIdLength(req, res);
    return undefined;
  }

  const matches = vehicles.filter((v) => v.vehicle.vehicleId === vehicleId);
  if (!matches || matches.length === 0) {
    sendNotFound(req, res);
    return undefined;
  }

  if (!matches[0].vehicle.vehicleAuthorizationIndicator) {
    sendVehicleNotAuthorized(req, res, true);
    return undefined;
  }

  return matches[0];
}

/**
 * Returns the command object that matches the request, or undefined if not found.
 * @param {*} req The request object.
 * @param {*} commandArray An array of command objects.
 * @returns The command object that matches the query parameters (commandId, vehicleId).
 */
function getCommand(req, commandArray) {
  let { commandId } = req.params;
  let { vehicleId } = req.params;
  commandId = toLower(commandId); // FordConnect server is case-insensitive.
  vehicleId = toLower(vehicleId);

  let searchLists = (commandArray !== undefined) ? { data: commandArray } : commands;

  // BUGFIX: FordConnect API returns matching commandId regardless of the route used.
  searchLists = commands;

  let match;
  Object.keys(searchLists).forEach((searchList) => {
    const matches = searchLists[searchList].filter(
      (c) => c.commandId === commandId && c.vehicleId === vehicleId,
    );

    if (matches && matches.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      match = matches[0];
      if (Date.now() - match.timestamp > commandTimeoutInSeconds * 1000) {
        console.log('command expired.');
        match = undefined;
      }
    }
  });

  return match;
}

/**
 * Returns a new command object (4 seconds of "PENDINGRESPONSE", then "COMPLETED")
 * @param {*} vehicleId The vehicleId for the command.
 * @returns A command object with a random commandId.
 */
function createCommand(vehicleId) {
  return {
    commandId: makeGuid(),
    vehicleId: toLower(vehicleId),
    timestamp: Date.now(),
    commandStatuses: '4000,PENDINGRESPONSE;-1,COMPLETED',
    commandStatus: 'PENDINGRESPONSE', // possible values: PENDINGRESPONSE, COMPLETED, FAILED
  };
}

app.post('/oauth2/v2.0/token', (req, res) => {
  let msg = '';

  if (!isValidClientId(req.fields['client_id'])) {
    msg = 'ERROR: Client_id not expected value.';
  } else if (!isValidClientSecret(req.fields['client_secret'])) {
    msg = 'ERROR: client_secret not expected value.';
  } else if (req.fields['grant_type'] === 'refresh_token') {
    if (isValidRefreshToken(req.fields['refresh_token'])) {
      return sendRefreshTokenResponse(req, res);
    }
    msg = 'ERROR: Refresh token not expected value.';
  } else if (req.fields['grant_type'] === 'authorization_code') {
    if (!isValidRedirectUri(req.fields['redirect_uri'])) {
      msg = 'ERROR: invalid redirect_url.';
    } else if (req.fields['code'] === code) {
      if (Date.now() < codeExpireTimestamp) {
        return sendRefreshTokenResponse(req, res);
      }

      // REVIEW: We are exposing the fact the code *was* valid by giving different error.
      msg = 'ERROR: invalid code parameter (Only good for 20 minutes.  Restart server.)';
    } else {
      msg = 'ERROR: invalid code parameter. (See server startup output, don\'t use real OAUTH code.)';
    }
  } else {
    msg = 'ERROR: grant_type not expected value.';
  }

  console.error(msg);
  return res.json({ error: 'invalid request', error_description: msg });
});

app.get('/api/fordconnect/vehicles/v1', (req, res) => {
  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  return res.json({ status: 'SUCCESS', vehicles: vehicles.map((v) => v.vehicle) });
});

/**
 * Processes a POST message for a vehicleId and invokes the callback method with the vehicle
 * and command object.
 *
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @param {*} requiresEv Boolean. Set to true if the API requires EV vehicle.
 * @param {*} fn Callback function(req, res, matchedVehicle, commandObject).
 * @returns The res.json result, or undefined in some error cases.
 */
function vehicleIdPostMethod(req, res, requiresEv, fn) {
  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    if (requiresEv && match.info && match.info.engineType !== 'EV') {
      return sendUnsupportedVehicle(req, res);
    }

    const command = createCommand(match.vehicle.vehicleId);

    // Invoke the callback function, with the matching vehicle and command object.
    fn(req, res, match, command);

    const response = {
      status: 'SUCCESS',
      commandStatus: 'COMPLETED',
      commandId: command.commandId,
    };

    res.statusCode = 202;
    return res.json(response);
  }

  return undefined; // getVehicleOrSendError send response.
}

/**
 * Processes a GET message for a vehicleId and invokes the callback method with the vehicle
 * and command object.
 * @param {*} req The request object.
 * @param {*} res THe response object.
 * @param {*} commandArray An array of command objects, or undefinded to use all command objects.
 * @param {*} fn Callback function(req, res, matchedVehicle, commandObject).
 * @returns The res.json result, or undefined in some error cases.
 */
function vehicleIdGetCommandStatus(req, res, commandArray, fn) {
  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    const command = getCommand(req, commandArray);
    if (command === undefined) {
      const { commandId } = req.params;
      return sendUnauthorizedUser(res, res, reflectedUserInput(commandId));
    }

    // Change the commandStatus based on how long ago the original POST request was.
    const statuses = command.commandStatuses.split(';');
    for (let i = 0; i < statuses.length; i += 1) {
      const s = statuses[i].split(',');
      const deltaTime = parseInt(s[0], 10);
      const status = s[1];
      if (deltaTime === -1 || (Date.now() < command.timestamp + deltaTime)) {
        command.commandStatus = status;
        break;
      }
    }

    const response = {
      status: 'SUCCESS',
      commandStatus: command.commandStatus,
      commandId: command.commandId,
    };

    // Invoke the callback function, with the matching vehicle and command object.
    fn(req, res, match, command, response);

    res.statusCode = 200;
    return res.json(response);
  }

  return undefined; // getVehicleOrSendError send response.
}

/**
 * Processes a GET request for a vehicle image (full or thumbnail).
 * @param {*} req The request object.
 * @param {*} res THe response object.
 * @param {*} fn Callback function(matchedVehicle).
 * @returns The res.json result, or undefined in some error cases.
 */
function vehicleIdGetImage(req, res, fn) {
  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const { make } = req.query;
  if (!isValidMake(make)) {
    return sendBadMakeParameter(req, res);
  }

  const { year } = req.query;
  if (!isValidYear(year)) {
    return sendBadYearParameter(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    const options = {
      root: path.join(__dirname, 'images'),
      cacheControl: false,
    };

    const imageName = fn(match);

    // TODO: Send same cache headers as FordConnect server.
    return res.sendFile(imageName, options);
  }

  return undefined; // getVehicleOrSendError send response.
}

app.post('/api/fordconnect/vehicles/v1/:vehicleId/unlock', (req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.unlock.push(command);
    match.extra.doorsLocked = false;
    match.extra.doorsLockedTimestamp = timestamp.now();
  });
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/unlock/:commandId', (req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.unlock, () => { });
});

app.post('/api/fordconnect/vehicles/v1/:vehicleId/lock', (req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.lock.push(command);
    match.extra.doorsLocked = true;
    match.extra.doorsLockedTimestamp = timestamp.now();
  });
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/lock/:commandId', (req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.lock, () => { });
});

app.post('/api/fordconnect/vehicles/v1/:vehicleId/startEngine', (req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.startEngine.push(command);
    match.extra.lastStarted = Date.now();
    match.info.vehicleStatus.remoteStartStatus = {
      status: 'ENGINE_RUNNING',
      duration: 0, // #10 - TODO: Does this need to change over time?
      timeStamp: timestamp.now(),
    };
    match.info.vehicleStatus.ignitionStatus.value = 'ON';
  });
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/startEngine/:commandId', (req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.startEngine, () => { });
});

app.post('/api/fordconnect/vehicles/v1/:vehicleId/stopEngine', (req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.stopEngine.push(command);
    match.extra.lastStarted = Date.now();
    match.info.vehicleStatus.remoteStartStatus = {
      status: 'ENGINE_STOPPED',
      duration: 0, // #10 - TODO: Does this need to change over time (minutes)?
      timeStamp: timestamp.now(),
    };
    match.info.vehicleStatus.ignitionStatus.value = 'OFF';
  });
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/stopEngine/:commandId', (req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.stopEngine, () => { });
});

app.post('/api/fordconnect/vehicles/v1/:vehicleId/wake', (req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.wake.push(command);
    match.extra.lastWake = Date.now();
  });
});

app.post('/api/fordconnect/vehicles/v1/:vehicleId/startCharge', (req, res) => {
  vehicleIdPostMethod(req, res, true, (_req, _res, match, command) => {
    commands.startCharge.push(command);
    match.extra.lastStartCharge = Date.now();
  });
});

app.post('/api/fordconnect/vehicles/v1/:vehicleId/stopCharge', (req, res) => {
  vehicleIdPostMethod(req, res, true, (_req, _res, match, command) => {
    commands.stopCharge.push(command);
    match.extra.lastStopCharge = Date.now();
  });
});

/**
 * Compares two coordinates (lat, long) to see if they are 'near' each other.
 * @param {*} lat1 Latitude for coordinate 1
 * @param {*} long1 Longitude for coordinate 1
 * @param {*} lat2 Latitude for coordinate 2
 * @param {*} long2 Longitude for coordinate 2
 * @returns Boolean. true is coordinate 1 and coordinate 2 are near each other.
 */
function near(lat1, long1, lat2, long2) {
  // For latitude a delta of 0.001 is about 360 feet
  // For longitude a delta of 0.001 depends on your latitude. (It is about 360 feet
  // near the equator & only about 200 feet near northern Canada.)
  return Math.abs(lat1 - lat2) < 0.001 && Math.abs(long1 - long2) < 0.001;
}

app.get('/api/fordconnect/vehicles/v1/:vehicleId/chargeSchedules', (req, res) => {
  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    let nearbySchedule;

    if (match.evdata && (match.info && match.info.engineType === 'EV')) {
      const matchLat = parseFloat(match.info.vehicleStatus.vehicleLocation.latitude);
      const matchLong = parseFloat(match.info.vehicleStatus.vehicleLocation.longitude);

      for (let i = 0; i < match.evdata.chargeSchedules.length; i += 1) {
        const s = match.evdata.chargeSchedules[i];
        const sLat = parseFloat(s.latitude);
        const sLong = parseFloat(s.longitude);
        if (near(matchLat, matchLong, sLat, sLong)) {
          nearbySchedule = s;
        }
      }
    }

    const response = {
      status: 'SUCCESS',
      // TEST: #23 - What is FordConnect API response if we aren't near any chargers?
      // For now we just return an empty array.
      chargeSchedules: (nearbySchedule !== undefined) ? nearbySchedule.schedule : [],
    };

    if (nearbySchedule && response.chargeSchedules) {
      for (let i = 0; i < response.chargeSchedules.length; i += 1) {
        response.chargeSchedules[i].desiredChargeLevel = nearbySchedule.desiredChargeLevel;
      }
    }

    res.statusCode = 200;
    return res.json(response);
  }

  return undefined; // getVehicleOrSendError send response.
});

const DAYS = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

// NOTE: This is a simulated day, not actual day.
const today = {
  hour: 16,
  minutes: 10,
  dayOfWeek: DAYS.THURSDAY,
};

/**
 * The number of milliseconds until the departureTime event.
 *
 * @param {*} departureTime an evdata.departureTimes[x] object.
 * @returns The number of milliseconds from today (simulated time) until the departureTime.
 */
function msUntilDepartureTime(departureTime) {
  const dow = DAYS[departureTime.dayOfWeek];
  // Create a timestamp (1-Mar-2021 was a Monday, 5-Mar-2021 was a Friday, etc.)
  const dt = Date.parse(`${dow} Mar 2021 ${departureTime.time}`);
  const nt = Date.parse(`${today.dayOfWeek} Mar 2021 ${today.hour}:${today.minutes}`);

  let diff = dt - nt;
  if (diff < 0) {
    // The time was in the past, so add 7 days to find the next occurance.
    diff += 7 * 24 * 60 * 60 * 1000;
  }

  return diff;
}

// Returns the next departure time.
app.get('/api/fordconnect/vehicles/v1/:vehicleId/departureTimes', (req, res) => {
  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    if (match.info && match.info.engineType !== 'EV') {
      return sendVehicleNotAuthorized(req, res, false);
    }

    let response;

    if (match.evdata && match.evdata.departureTimes && match.evdata.departureTimes.length > 0) {
      let minIndex = 0;
      let minValue = msUntilDepartureTime(match.evdata.departureTimes[0]);
      for (let i = 0; i < match.evdata.departureTimes.length; i += 1) {
        const v = msUntilDepartureTime(match.evdata.departureTimes[i]);
        if (v < minValue) {
          minValue = v;
          minIndex = i;
        }
      }
      response = {
        status: 'SUCCESS',
        departureTimes: {
          dayOfWeek: match.evdata.departureTimes[minIndex].dayOfWeek,
          enabled: true,
          hour: parseInt(match.evdata.departureTimes[minIndex].time.split(':')[0], 10),
          minutes: parseInt(match.evdata.departureTimes[minIndex].time.split(':')[1], 10),
          preConditioningSetting: match.evdata.departureTimes[minIndex].preConditioningSetting,
        },
      };
    } else {
      response = {
        status: 'SUCCESS',
        departureTimes: {
          dayOfWeek: 'MONDAY',
          enabled: false,
          hour: 0,
          minutes: 0,
          preConditioningSetting: 'OFF',
        },
      };
    }

    res.statusCode = 200;
    res.json(response);
  }

  return undefined; // getVehicleOrSendError send response.
});

app.post('/api/fordconnect/vehicles/v1/:vehicleId/status', (req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.status.push(command);
  });
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/statusrefresh/:commandId', (req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.status, (_, __, match, command, response) => {
    if (command.commandStatus === 'COMPLETED') {
      response.vehicleStatus = {
        lockStatus: {
          value: match.extra.doorsLocked ? 'LOCKED' : 'UNLOCKED',
          timestamp: match.extra.doorsLockedTimestamp,
        },
        alarm: {
          // TODO: #30 - What is proper value for an enabled alarm?
          value: match.extra.alarmEnabled ? 'SET' : 'NOTSET',
          timestamp: match.extra.alarmTimestamp,
        },
      };
    }
  });
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId', (req, res) => {
  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    const vehicleDetails = {
      status: 'SUCCESS',
      vehicle: (match.info === undefined) ? {
        ...DeepCopy(match.vehicle),
      } : {
        ...DeepCopy(match.vehicle),
        ...DeepCopy(match.info),
      },
    };

    return res.json(vehicleDetails);
  }

  return undefined; // getVehicleOrSendError send response.
});

app.post('/api/fordconnect/vehicles/v1/:vehicleId/location', (req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.location.push(command);
  });
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/location', (req, res) => {
  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    if (match.info && match.info.vehicleStatus) {
      const location = {
        status: 'SUCCESS',
        vehicleLocation: DeepCopy(match.info.vehicleStatus.vehicleLocation),
      };

      return res.json(location);
    }

    return sendVehicleNotAuthorized(req, res, false);
  }

  return undefined; // getVehicleOrSendError send response.
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/images/full', (req, res) => {
  vehicleIdGetImage(req, res, (match) => match.extra.image);
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/images/thumbnail', (req, res) => {
  vehicleIdGetImage(req, res, (match) => match.extra.imageThumbnail);
});

/**
 * Parses a query parameter into a boolean value.
 *
 * @param {*} value A query parameter to convert to boolean.
 * @returns Boolean or undefined. parsed value (true, false) or undefined if not parsable.
 */
function toBoolean(value) {
  let bool;
  if (value !== undefined) {
    value = toLower(value);
    if (value === 'false' || value === 'no' || value === 'off') {
      bool = false;
    } else if (value === 'true' || value === 'yes' || value === 'on') {
      bool = true;
    }
  }

  return bool;
}

/**
 * Parses a query parameter into a direction value.
 *
 * @param {*} value A query parameter to convert to a direction.
 * @returns String or undefined. parsed value (North, South, etc.)
 */
function toDirection(value) {
  let dir;
  if (value !== undefined) {
    value = toLower(value);
    if (value === 'north') {
      dir = 'North';
    } else if (value === 'south') {
      dir = 'South';
    } else if (value === 'east') {
      dir = 'East';
    } else if (value === 'west') {
      dir = 'West';
    } else if (value === 'northwest') {
      dir = 'NorthWest';
    } else if (value === 'northeast') {
      dir = 'NorthEast';
    } else if (value === 'southwest') {
      dir = 'SouthWest';
    } else if (value === 'southeast') {
      dir = 'SouthEast';
    }
  }

  return dir;
}

/**
 * Parses a query parameter into a door value.
 *
 * @param {*} value A query parameter to convert to a door.
 * @returns String or undefined. parsed value (HOOD_DOOR, TAILGATE, etc.)
 */
function toDoor(value) {
  let doorValue;
  if (value) {
    value = toLower(value);
    if (value.indexOf('front') >= 0) {
      doorValue = 'UNSPECIFIED_FRONT';
    } else if (value.indexOf('hood') >= 0) {
      doorValue = 'HOOD_DOOR';
    } else if (value.indexOf('tailgate') >= 0) {
      if (value.indexOf('inner') >= 0) {
        doorValue = 'INNER_TAILGATE';
      } else if (value === 'tailgate') {
        doorValue = 'TAILGATE';
      }
    } else if (value.indexOf('rear') >= 0) {
      if (value.indexOf('left') >= 0) {
        doorValue = 'REAR_LEFT';
      } else if (value.indexOf('right') >= 0) {
        doorValue = 'REAR_RIGHT';
      }
    }
  }

  return doorValue;
}

/**
 * Parses a query parameter into a state (open/closed) value.
 *
 * @param {*} value A query parameter to convert to a state.
 * @returns String or undefined. parsed value (OPEN, CLOSED.)
 */
function toState(value) {
  let state;
  if (value) {
    value = toLower(value);
    if (value === 'open') {
      state = 'OPEN';
    } else if (value === 'closed') {
      state = 'CLOSED';
    }
  }

  return state;
}

/**
 * Parses a query parameter into a role (DRIVER, PASSENGER, NOT_APPLICABLE) value.
 *
 * @param {*} value A query parameter to convert to a role.
 * @returns String or undefined. parsed value (DRIVER, PASSENGER, NOT_APPLICABLE)
 */
function toRole(value) {
  let role;
  if (value) {
    value = toLower(value);
    if (value === 'driver') {
      role = 'DRIVER';
    } else if (value === 'passenger') {
      role = 'PASSENGER';
    } else if (value.startsWith('n')) {
      role = 'NOT_APPLICABLE';
    }
  }

  return role;
}

/**
 * Parses a query parameter into a float value.
 *
 * @param {*} value A query parameter to convert to float.
 * @returns float or undefined.
 */
function toFloat(value) {
  if (value !== undefined) {
    value = parseFloat(value);
    if (Number.isNaN(value)) {
      value = undefined;
    }
  }

  return value;
}

// Set the simulator's today value (used for determining the next departure time.)
//
// param: day  (MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY)
// param: time (24-hour format, hh:mm, like 13:15 for 1:15PM)
// expected status: 200 (success), 400 (bad parameter)
//
// example query: /sim/today?day=FRIDAY&time=13:15
app.post('/sim/today', (req, res) => {
  const { day } = req.query;
  const { time } = req.query;

  const dayOfWeek = DAYS[day];
  const t = (time !== undefined) ? time.split(':') : [];
  const h = (t.length === 2) ? parseInt(t[0], 10) : -1;
  const m = (t.length === 2) ? parseInt(t[1], 10) : -1;

  if (dayOfWeek === undefined) {
    res.statusCode = 400;
    return res.json({
      status: 'ERROR',
      msg: 'parameter \'day\' must be (MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY).',
    });
  }

  if (h < 0 || h > 23 || m < 0 || m > 59 || (t.length === 2 && t[1].length > 2)) {
    res.statusCode = 400;
    return res.json({
      status: 'ERROR',
      msg: 'parameter \'time\' must be in 24 hour format (hh:mm).',
    });
  }

  today.dayOfWeek = dayOfWeek;
  today.hour = h;
  today.minutes = m;

  res.statusCode = 200;
  return res.json({
    status: 'SUCCESS',
    msg: 'Date set successfully.',
  });
});

// Sets the tirePressureWarning on a vehicle.
//
// param: warning  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/psi/22221111111111151111111111112222?warning=true
app.post('/sim/psi/:vehicleId', (req, res) => {
  const { warning } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    const setting = toBoolean(warning);

    if (setting === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'warning\' must be (true or false).',
      });
    }

    match.info.vehicleStatus.tirePressureWarning = setting;

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: `PSI warning set to ${setting} successfully.`,
    });
  }

  return undefined;
});

// Sets the modem on a vehicle.
//
// param: enabled  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/modem/22221111111111151111111111112222?enabled=false
app.post('/sim/modem/:vehicleId', (req, res) => {
  const { enabled } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    const setting = toBoolean(enabled);

    if (setting === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'enabled\' must be (true or false).',
      });
    }

    match.vehicle.modemEnabled = setting;
    // TODO: #25 - Should features get disabled when modem is disabled?

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: `Modem enabled set to ${setting} successfully.`,
    });
  }

  return undefined;
});

// Sets the deep sleep for the vehicle.
//
// param: sleep  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/deepsleep/22221111111111151111111111112222?sleep=false
app.post('/sim/deepsleep/:vehicleId', (req, res) => {
  const { sleep } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    const setting = toBoolean(sleep);

    if (setting === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'sleep\' must be (true or false).',
      });
    }

    match.info.vehicleStatus.deepSleepInProgress = setting;
    // TODO: #25 - Should features get disabled when deepSleepInProgress?

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: `Deep sleep enabled set to ${setting} successfully.`,
    });
  }

  return undefined;
});

// Sets the firmwareUpgradeInProgess on a vehicle.
//
// param: upgrade  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/firmware/22221111111111151111111111112222?upgrade=true
app.post('/sim/firmware/:vehicleId', (req, res) => {
  const { upgrade } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    const setting = toBoolean(upgrade);

    if (setting === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'upgrade\' must be (true or false).',
      });
    }

    match.info.vehicleStatus.firmwareUpgradeInProgress = setting;

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: `Firmware upgrade in progress set to ${setting} successfully.`,
    });
  }

  return undefined;
});

// Sets the plug status on an EV vehicle.
//
// param: connected  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/plug/22221111111111151111111111112222?connected=true
app.post('/sim/plug/:vehicleId', (req, res) => {
  const { connected } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    if (!match.info || match.info.engineType !== 'EV') {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'vehicleId is not an EV vehicle.',
      });
    }

    const setting = toBoolean(connected);

    if (setting === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'connected\' must be (true or false).',
      });
    }

    match.info.vehicleStatus.plugStatus.value = setting;
    match.info.vehicleStatus.plugStatus.timeStamp = timestamp.now();
    // TODO: #26 - Should charging status change?

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: `Plug status set to ${setting} successfully.`,
    });
  }

  return undefined;
});

// Sets the ignition status on the vehicle.
//
// param: value  (on/off)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/ignition/22221111111111151111111111112222?value=on
app.post('/sim/ignition/:vehicleId', (req, res) => {
  const { value } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    const setting = toBoolean(value);

    if (setting === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'value\' must be (on or off).',
      });
    }

    match.info.vehicleStatus.ignitionStatus.value = setting ? 'ON' : 'OFF';
    match.info.vehicleStatus.ignitionStatus.timeStamp = timestamp.now();
    // TODO: #27 - Should remote start status change if it was ENGINE_RUNNING?

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: `Ingition status set to ${match.info.vehicleStatus.ignitionStatus.value} successfully.`,
    });
  }

  return undefined;
});

// Sets the fuel level on an ICE vehicle.
//
// param: level  (0 to 100.0)
// param: dte (distance to empty, in km.)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/fuel/12341234123412341234123412341234?level=100.0&dte=700.0
app.post('/sim/fuel/:vehicleId', (req, res) => {
  const { level } = req.query;
  const { dte } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    if (!match.info || match.info.engineType !== 'ICE') {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'vehicleId is not an ICE vehicle.',
      });
    }

    const levelSetting = toFloat(level);
    const distanceToEmpty = toFloat(dte);

    if (levelSetting === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'level\' should be a float (0 to 100).',
      });
    }

    if (distanceToEmpty === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'dte\' should be a float (distance in km)).',
      });
    }

    match.info.vehicleDetails.fuelLevel.value = levelSetting;
    match.info.vehicleDetails.fuelLevel.distanceToEmpty = distanceToEmpty;
    match.info.vehicleDetails.fuelLevel.timestamp = timestamp.now();

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: 'Set fuel level successfully.',
    });
  }

  return undefined;
});

// Sets the battery level on an EV vehicle.
//
// param: level  (0 to 100.0)
// param: dte (distance to empty, in km.)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/battery/22221111111111151111111111112222?level=100.0&dte=400.0
app.post('/sim/battery/:vehicleId', (req, res) => {
  const { level } = req.query;
  const { dte } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    if (!match.info || match.info.engineType !== 'EV') {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'vehicleId is not an EV vehicle.',
      });
    }

    const levelSetting = toFloat(level);
    const distanceToEmpty = toFloat(dte);

    if (levelSetting === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'level\' should be a float (0 to 100).',
      });
    }

    if (distanceToEmpty === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'dte\' should be a float (distance in km)).',
      });
    }

    match.info.vehicleDetails.batteryChargeLevel.value = levelSetting;
    match.info.vehicleDetails.batteryChargeLevel.distanceToEmpty = distanceToEmpty;
    match.info.vehicleDetails.batteryChargeLevel.timestamp = timestamp.now();

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: 'Set battery level successfully.',
    });
  }

  return undefined;
});

// Sets the location of a vehicle.
//
// param: lat   (-90.0 to 90.0)
// param: long  (-180.0 to 180.0)
// param: distance (float, miles to add to mileage/odometer. can be 0.0)
// param: speed  (optional, float)
// param: direction (optional: north, south, east, west, northwest, northeast, southwest, southeast)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query:
//  /sim/location/22221111111111151111111111112222?lat=36.105539&long=-95.885703&distance=3.1
app.post('/sim/location/:vehicleId', (req, res) => {
  const { lat } = req.query;
  const { long } = req.query;
  const { distance } = req.query;
  const { speed } = req.query;
  const { direction } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    const latitude = toFloat(lat);
    const longitude = toFloat(long);
    const distanceInMiles = toFloat(distance);
    const updatedSpeed = toFloat(speed);
    const dir = toDirection(direction);

    if (latitude === undefined || latitude < -90.0 || latitude > 90.0) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'lat\' should be a float (-90.0 to 90.0).',
      });
    }

    if (longitude === undefined || longitude < -180.0 || longitude > 180.0) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'long\' should be a float (-180.0 to 180.0).',
      });
    }

    if (distanceInMiles === undefined || distance < 0.0) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'distance\' should be a positve float (can be 0.0).',
      });
    }

    if (dir === undefined && direction && direction.length > 0) {
      res.statusCode = 400;
      const validValues = 'North, South, East, West, NorthWest, NorthEast, SouthWest, SouthEast';
      return res.json({
        status: 'ERROR',
        msg: `optional parameter 'direction' should be (${validValues}).`,
      });
    }

    match.info.vehicleStatus.vehicleLocation.latitude = latitude.toFixed(6).toString();
    match.info.vehicleStatus.vehicleLocation.longitude = longitude.toFixed(6).toString();
    match.info.vehicleStatus.vehicleLocation.timeStamp = timestamp.now();
    match.info.vehicleDetails.mileage += distanceInMiles;
    match.info.vehicleDetails.odometer += (distanceInMiles * 1.609344);

    if (updatedSpeed !== undefined) {
      match.info.vehicleStatus.vehicleLocation.speed = updatedSpeed;
    }

    if (dir !== undefined) {
      match.info.vehicleStatus.vehicleLocation.direction = dir;
    }

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: 'Set location successfully.',
    });
  }

  return undefined;
});

// Opens or closes a door on the vehicle.
//
// param: door  (HOOD_DOOR, REAR_LEFT, etc.)
// param: state (OPEN, CLOSED)
// param: role  (optional, if door is unique. DRIVER, PASSENGER, NOT_APPLICABLE)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query:
//  /sim/door/22221111111111151111111111112222?door=UNSPECIFIED_FRONT&role=DRIVER&state=OPEN
app.post('/sim/door/:vehicleId', (req, res) => {
  let { door } = req.query;
  let { state } = req.query;
  const { role } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    door = toDoor(door);

    if (door === undefined) {
      res.statusCode = 400;
      const validValues = 'UNSPECIFIED_FRONT,HOOD_DOOR,REAR_LEFT,REAR_RIGHT,TAILGATE,INNER_TAILGATE';
      return res.json({
        status: 'ERROR',
        msg: `optional parameter 'door' should be (${validValues}).`,
      });
    }

    state = toState(state);
    if (state === undefined) {
      res.statusCode = 400;
      const validValues = 'OPEN, CLOSED';
      return res.json({
        status: 'ERROR',
        msg: `optional parameter 'state' should be (${validValues}).`,
      });
    }

    const occupantRole = toRole(role);
    if (occupantRole === undefined && role && role.length > 0) {
      res.statusCode = 400;
      const validValues = 'DRIVER,PASSENGER,NOT_APPLICABLE';
      return res.json({
        status: 'ERROR',
        msg: `optional parameter 'role' should be (${validValues}).`,
      });
    }

    const doors = match.info.vehicleStatus.doorStatus.filter((d) => d.vehicleDoor === door
      && (!occupantRole || d.vehicleOccupantRole === occupantRole));

    if (!doors || doors.length === 0) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'could not find door matching the requested parameter combination.',
      });
    }

    if (!doors || doors.length > 1) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'multiple doors matched parameters, please include \'role\' parameter.',
      });
    }

    doors[0].value = state;
    doors[0].timeStamp = timestamp.now();

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: `Door state changed to ${state} successfully.`,
    });
  }

  return undefined;
});

// Sets the alarm for the vehicle.
//
// param: enabled  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/alarm/22221111111111151111111111112222?enabled=true
app.post('/sim/alarm/:vehicleId', (req, res) => {
  const { enabled } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    const setting = toBoolean(enabled);

    if (setting === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'enabled\' must be (true or false).',
      });
    }

    match.extra.alarmEnabled = setting;
    match.extra.alarmTimestamp = timestamp.now();

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: `Alarm set to ${setting} successfully.`,
    });
  }

  return undefined;
});

app.use((req, res) => {
  res.status(404).send('The route you requested is not supported by this simulator. Verify GET/POST usage and path.');
});

exports.server = app;
exports.vehicleData = vehicles;
