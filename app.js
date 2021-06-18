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
 *
 *
 * If you have a new mock vehicle, update vehicles.js with an additional export.
 *
 */

// Contributors to the simulator, please search for "TEST:", "REVIEW:" and "TODO:" comments.

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
 * @param {info} vehicleInfo The vechicle information JSON (like vehicleDetails,
 * vehicleStatus, etc.)
 * @returns The extra property for the vehicle, or undefined.
 */
function makeExtra(vehicleInfo) {
  if (vehicleInfo === undefined) {
    return undefined;
  }

  // TODO: We could set Started/Stopped based on vehicleInfo?
  return {
    doorsLocked: true,
    lastStarted: 0, // These are Date.now() values.
    lastStopped: 0,
    lastWake: 0,
    lastStartCharge: 0,
    lastStopCharge: 0,
  };
}

// TODO: Make this an environment variable & rename it to timeoutDurationInSeconds or something.
const twentyMinsInSeconds = 20 * 60;

// REVIEW: Should we refactor this code into vehicles.js?
const vehicles = [];
vehicles.push({
  vehicle: mockVehicles.ice1,
  info: mockVehicles.ice1_info,
  extra: makeExtra(mockVehicles.ice1_info),
});
// IMPORTANT: Put your list of test vehicles here.  See the README.md file for directions.
vehicles.push({
  vehicle: mockVehicles.ice2,
  info: undefined,
  extra: undefined,
});
vehicles.push({
  vehicle: mockVehicles.ev1,
  info: mockVehicles.ev1_info,
  extra: makeExtra(mockVehicles.ev1_info),
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
console.log(`Listening on port ${httpPort}`);

// TODO: Add HTTPS support.  For now we just have HTTP support on the httpPort.
const httpServer = http.createServer(app);
httpServer.listen(httpPort);

// We have POST data for our OAuth2 routes.  Use express-formidable middleware to parse.
app.use(formidable());

// The code is only good until the codeExpireTimestamp.
// TODO: Use a random code instead of pseudo-predictable value.
const code = process.env.FORDSIM_CODE || `Code${Date.now()}`;
const codeExpireTimestamp = Date.now() + twentyMinsInSeconds * 1000;
console.log(`Code is: ${code}`);

// This token expires after tokenExpireTimestamp. The token will change when refreshed.
let token = process.env.FORDSIM_TOKEN; // It's okay (preferred) if this value is UNDEFINED.
let tokenExpireTimestamp = Date.now() + twentyMinsInSeconds * 1000;
if (token !== undefined) {
  console.log(`Token: ${token}`);
}

// The refresh token expires after 90 days (so we don't simulate expiration in the simulator).
// REVIEW: The refreshToken will change when refreshed (but old refreshTokens can be used).
// TODO: Should we allow user to simulate a refreshToken expiring?
//   (How do we know what the FordConnect service will do?)
let refreshToken;
if (refreshToken !== undefined) {
  console.log(`Refresh token is: ${refreshToken}`);
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
 * original object.
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

  if (reqToken !== token) {
    // TEST: #13 - How does the FordConnect server work; should we allow all non-expired tokens?
    //  (or should only allow the most recent token)?
    console.error('ERROR: The token does not match the expected value.');
    return true;
  }

  if (Date.now() < tokenExpireTimestamp) {
    // This should be the typical case, since client shouldn't use expired tokens.
    return false;
  }

  console.warn('WARN: The token has expired. Your client  should look at expires_in or expires_on timestamp.');
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
      // TEST: Do null values get returned in our JSON response?
      response.chargeSchedules = null;
    } else if (req.originalUrl.indexOf('/departureTimes') > 0) {
      // TEST: Do null values get returned in our JSON response?
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

  if (token === undefined) {
    // TODO: SECURITY: Replace with better token.
    token = 'eyJ0eXAiOiJKV1QifQ==';
  }
  if (token.indexOf('==') < 0) {
    token += '==';
  }

  if (refreshToken === undefined) {
    // TODO: SECURITY: Replace with better token. (current validation has constraints on value.)
    refreshToken = 'eyJ0eXAiOiJKV1QifQAREFRESH==';
  }
  if (refreshToken.indexOf('==') < 0) {
    refreshToken += '==';
  }

  token = token.replace('==', 'AAAA==');
  tokenExpireTimestamp = now + twentyMinsInSeconds * 1000;
  console.info(`Issued access token: ${token}`);

  refreshToken = refreshToken.replace('==', 'AAAA==');

  return res.json({
    access_token: token,
    id_token: 'eyJAAA==', // Stub - we don't use this.
    token_type: 'Bearer',
    not_before: Math.trunc(now / 1000),
    expires_in: twentyMinsInSeconds,
    expires_on: Math.trunc(tokenExpireTimestamp / 1000),
    resource: 'c1e4c1a0-2878-4e6f-a308-836b34474ea9',
    id_token_expires_in: twentyMinsInSeconds,
    profile_info: 'ejyAAA==', // Stub - we don't use this.
    scope: 'https://simulated-environment.onmicrosoft.com/fordconnect/access openid offline_access',
    refresh_token: refreshToken,
    refresh_token_expires_in: 7776000, // 90 days.
  });
}

/**
 * Validates the client_id parameter is the expected value.
 * @param {*} clientIdValue The value to validate.
 * @returns Boolean. Returns true if the parameter was a valid value, otherwise false.
 */
function isValidClientId(clientIdValue) {
  // TODO: SECURITY: Replace with stronger client id.  :)
  const clientIdPrefix = '3';
  return clientIdValue && clientIdValue.startsWith(clientIdPrefix);
}

/**
 * Validates the client_secret parameter is the expected value.
 * @param {*} clientSecretValue The value to validate.
 * @returns Boolean. Returns true if the parameter was a valid value, otherwise false.
 */
function isValidClientSecret(clientSecretValue) {
  // TODO: SECURITY: Replace with stronger client secret.  :)
  const clientSecretPrefix = 'T';
  return clientSecretValue && clientSecretValue.startsWith(clientSecretPrefix);
}

/**
 * Validates the redirect_uri parameter is the expected value.
 * @param {*} redirectUriValue The value to validate.
 * @returns Boolean. Returns true if the parameter was a valid value, otherwise false.
 */
function isValidRedirectUri(redirectUriValue) {
  // TODO: SECURITY: Replace with uri validation rules.
  return redirectUriValue && redirectUriValue.toLowerCase().startsWith('http');
}

/**
 * Validates the refresh_token parameter is the expected value.
 * @param {*} refreshTokenValue The value to validate.
 * @returns Boolean. Returns true if the parameter was a valid value, otherwise false.
 */
function isValidRefreshToken(refreshTokenValue) {
  const refreshTokenPrefix = 'ey';
  const refreshTokenContains = 'REFRESH';

  // The FordConnect API currently allows replay of refresh_tokens for 90 days.
  // TODO: SECURITY: Make sure the token matches known token list.
  return refreshTokenValue
    && refreshTokenValue.startsWith(refreshTokenPrefix)
    && refreshTokenValue.indexOf(refreshTokenContains);
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

  makeValue = makeValue.toLowerCase();
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
  commandId = commandId.toLowerCase(); // FordConnect server is case-insensitive.
  vehicleId = vehicleId.toLowerCase();

  let searchLists = (commandArray !== undefined) ? { data: commandArray } : commands;

  // BUGFIX: FordConnect API returns matching commandId regardless of the route used.
  searchLists = commands;

  let match;
  Object.keys(searchLists).forEach((searchList) => {
    const matches = searchLists[searchList].filter(
      // TEST: #15 - Is there a timeout on how long a command is valid for?
      (c) => c.commandId === commandId && c.vehicleId === vehicleId,
    );

    if (matches && matches.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      match = matches[0];
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
    // Modified from https://www.arungudelli.com/tutorial/javascript/how-to-create-uuid-guid-in-javascript-with-examples/
    commandId: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      // eslint-disable-next-line no-bitwise
      const r = Math.random() * 16 | 0;
      // eslint-disable-next-line no-mixed-operators, no-bitwise
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }),
    vehicleId: vehicleId.toLowerCase(),
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

    // Invoke the callback function, with the matching vehicle and command object.
    fn(req, res, match, command);

    const response = {
      status: 'SUCCESS',
      commandStatus: command.commandStatus,
      commandId: command.commandId,
    };

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
  });
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/unlock/:commandId', (req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.unlock, () => { });
});

app.post('/api/fordconnect/vehicles/v1/:vehicleId/lock', (req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.lock.push(command);
    match.extra.doorsLocked = true;
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
      status: 'ENGINE_STOPPED', // REVIEW: #17 - Based on SPEC.
      duration: 0, // #10 - TODO: Does this need to change over time (minutes)?
      timeStamp: timestamp.now(),
    };
    match.info.vehicleStatus.ignitionStatus.value = 'OFF'; // REVIEW: Based on SPEC.
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
    // TODO: Update some timestamps + location info?
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
    // TODO: Update location info.
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
  // TODO: Support associating the image with the vehicle.
  vehicleIdGetImage(req, res, () => 'full-image.png');
});

app.get('/api/fordconnect/vehicles/v1/:vehicleId/images/thumbnail', (req, res) => {
  // TODO: Support associating the image with the vehicle.
  vehicleIdGetImage(req, res, () => 'thumbnail.png');
});

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

/**
 * Parses a query parameter into a boolean value.
 *
 * @param {*} value A query parameter to convert to boolean.
 * @returns Boolean or undefined. parsed value (true, false) or undefined if not parsable.
 */
function toBoolean(value) {
  let bool;
  if (value !== undefined) {
    value = value.toLowerCase();
    if (value === 'false' || value === 'no') {
      bool = false;
    } else if (value === 'true' || value === 'yes') {
      bool = true;
    }
  }

  return bool;
}

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
// example query: /sim/modem/22221111111111151111111111112222?enabled=false
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
      msg: `Modem enabled set to ${setting} successfully.`,
    });
  }

  return undefined;
});

// Sets the firmwareUpgradeInProgess on a vehicle.
//
// param: warning  (true/false)
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

app.use((req, res) => {
  res.status(404).send('The route you requested is not supported by this simulator. Verify GET/POST usage and path.');
});
