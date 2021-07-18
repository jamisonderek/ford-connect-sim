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
const https = require('https');
const formidable = require('express-formidable');
const path = require('path');
const fs = require('fs');
const { createWriteStream } = require('fs');
const timestamp = require('./timestamp');
const mockVehicles = require('./vehicles');

const { toBoolean, toFloat } = require('./convert');
const { toDoor, toRole, toState } = require('./convert');
const { toDirection } = require('./convert');

const { makeGuid } = require('./guid');

const { getAccessTokenTimeout, getCodeTimeout } = require('./timeout');

const { getTokenFromRequest, isTokenExpired, isValidRefreshToken } = require('./token');
const { generateToken, isValidApplicationId } = require('./token');

const { isValidMake, isValidYear } = require('./validate');
const { isValidClientId, isValidClientSecret, isValidRedirectUri } = require('./validate');

const { commands, createCommand, getCommand } = require('./command');

const {
  updateTokenFromCode,
  refreshToken,
  getVehicles,
  getDetails,
  imageFull,
  imageThumbnail,
  getDepartureTimes,
  getChargeSchedule,
} = require('./fordConnect/fordConnect');

const app = express();

/**
 * This is a wrapper for all of the async app calls, so exceptions get forwared on to the next
 * handler.
 *
 * @param {*} fn the async function to wrap.
 * @returns a wrapped function.
 */
function asyncAppWrapper(fn) {
  if (process.env.NODE_ENV !== 'test') {
    return (req, res, next) => {
      fn(req, res, next).catch(next);
    };
  }

  return (req, res, next) => { fn(req, res, next); };
}

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
    alarmTriggered: false,
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
let code = process.env.FORDSIM_CODE || `Code${makeGuid()}`;
let codeExpireTimestamp = Date.now() + getCodeTimeout() * 1000;
console.log(`Code is: ${code}`);

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
 * Sends an HTTP 400 response that the vehicleId parameter was not the proper length.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @returns The res.json result.
 */
function sendBadVehicleIdLength(req, res) {
  res.statusCode = 400;
  // No Vehicleid header is sent back.
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
  // No Vehicleid header is sent back.
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
  // No Vehicleid header is sent back.
  return res.json({
    errorCode: '400',
    errorMessage: 'Invalid year parameter.  Must be four digit format (like 2019).',
  });
}

/**
 * Sends an HTTP 401 response that the applicationId is not valid.
 * @param {*} req The request object.
 * @param {*} res The response object.
 * @returns The res.json result.
 */
function sendInvalidApplicationId(req, res) {
  const appId = req.headers['application-id'];
  res.statusCode = 401;
  // No Vehicleid header is sent back.
  const message = `Access denied due to ${appId === undefined ? 'missing' : 'invalid'} subscription key.`;
  return res.json({
    statusCode: 401,
    message,
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
  // No Vehicleid header is sent back.
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
 * @param {*} vehicleId The vehicleId the user specified or undefined.
 *
 * @returns The res.json result.
 */
function sendUnauthorizedUser(req, res, commandId, vehicleId) {
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
  if (vehicleId) {
    res.setHeader('Vehicleid', vehicleId);
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
  const { vehicleId } = req.params;
  res.statusCode = 404;
  if (vehicleId) {
    res.setHeader('Vehicleid', reflectedUserInput(vehicleId));
  }
  const response = {
    error: {
      code: 4002,
      title: 'Resource not found',
      details: 'The resource was not found.',
      statusCode: 'NOT_FOUND',
    },
    status: 'FAILED',
  };

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
 * @param {*} vehicleId The vehicleId the user specified or undefined.
 * @param {*} addNullDepartureTimes If set, then a null depatureTimes will be added.
 * @returns The res.json result.
 */
function sendVehicleNotAuthorized(req, res, isPost, vehicleId, addNullDepartureTimes) {
  if (isPost) {
    return sendUnauthorizedUser(req, res, undefined, vehicleId);
  }

  res.statusCode = 406;
  const response = {
    error: {
      code: 4006,
      title: 'Not Acceptable',
      details: 'Not acceptable',
      statusCode: 'NOT_ACCEPTABLE',
    },
    status: 'FAILED',
  };
  if (addNullDepartureTimes) {
    response.departureTimes = null;
  }
  if (vehicleId) {
    res.setHeader('Vehicleid', vehicleId);
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
  const { vehicleId } = req.params;
  res.statusCode = 406;
  res.setHeader('Vehicleid', reflectedUserInput(vehicleId));
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
  const simRefreshToken = generateToken(undefined, true);

  return res.json({
    access_token: token.key,
    id_token: 'eyJAAA==', // Stub - we don't use this.
    token_type: 'Bearer',
    not_before: Math.trunc(now / 1000),
    expires_in: getAccessTokenTimeout(),
    expires_on: Math.trunc(token.expires / 1000),
    resource: 'c1e4c1a0-2878-4e6f-a308-836b34474ea9',
    id_token_expires_in: getAccessTokenTimeout(),
    profile_info: 'ejyAAA==', // Stub - we don't use this.
    scope: 'https://simulated-environment.onmicrosoft.com/fordconnect/access openid offline_access',
    refresh_token: simRefreshToken.key,
    refresh_token_expires_in: 7776000, // 90 days.
  });
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
    sendVehicleNotAuthorized(req, res, true, reflectedUserInput(vehicleId));
    return undefined;
  }

  return matches[0];
}

/**
 * Internal method for sending the oauth response.
 * @param {*} req The client request object.
 * @param {*} res The response object.
 * @returns res.json A response will be sent.
 */
function oauth(req, res) {
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
    } else if (req.fields['code'] === code || (code === '*' && req.fields['code'])) {
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
}

app.post('/oauth2/v2.0/token', asyncAppWrapper((req, res) => oauth(req, res)));
app.post('/:guid/oauth2/v2.0/token', asyncAppWrapper((req, res) => oauth(req, res)));

app.get('/api/fordconnect/vehicles/v1', asyncAppWrapper((req, res) => {
  if (!isValidApplicationId(req)) {
    return sendInvalidApplicationId(req, res);
  }

  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  return res.json({ status: 'SUCCESS', vehicles: vehicles.map((v) => v.vehicle) });
}));

/**
 * Checks if a vehicle supports EV functions.
 *
 * @param {*} engineType The engine type.
 * @returns Boolean. true if the vehicle supports EV functions.
 */
function isEV(engineType) {
  // PHEV (Plug-in Hybrid Electric Vehicle) and BEV (Battery Electric Vehicle) are EVs.
  // ICE (Internal Combustion Engine) is NOT an EV.
  return engineType && engineType.toUpperCase().indexOf('EV') >= 0;
}

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
  if (!isValidApplicationId(req)) {
    return sendInvalidApplicationId(req, res);
  }

  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    if (requiresEv && match.info && !isEV(match.info.engineType)) {
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
    res.setHeader('Vehicleid', match.vehicle.vehicleId);
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
 * @param {*} successCode The HTTP code to return on success.
 * @returns The res.json result, or undefined in some error cases.
 */
function vehicleIdGetCommandStatus(req, res, commandArray, fn, successCode) {
  if (!isValidApplicationId(req)) {
    return sendInvalidApplicationId(req, res);
  }

  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    const command = getCommand(req, commandArray);
    if (command === undefined) {
      const { commandId } = req.params;
      return sendUnauthorizedUser(res, res, reflectedUserInput(commandId), match.vehicle.vehicleId);
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

    res.statusCode = (successCode === undefined) ? 200 : successCode;
    res.setHeader('Vehicleid', match.vehicle.vehicleId);
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
  if (!isValidApplicationId(req)) {
    return sendInvalidApplicationId(req, res);
  }

  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const { make } = req.query;
  if (make === undefined) {
    res.statusCode = 404;
    return res.json({ statusCode: 404, message: 'Resource not found' });
  }
  if (!isValidMake(make)) {
    return sendBadMakeParameter(req, res);
  }

  const { model } = req.query;
  if (model === undefined) {
    res.statusCode = 404;
    return res.json({ statusCode: 404, message: 'Resource not found' });
  }

  const { year } = req.query;
  if (year === undefined) {
    res.statusCode = 404;
    return res.json({ statusCode: 404, message: 'Resource not found' });
  }
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
    res.setHeader('Vehicleid', match.vehicle.vehicleId);
    return res.sendFile(imageName, options);
  }

  return undefined; // getVehicleOrSendError send response.
}

app.post('/api/fordconnect/vehicles/v1/:vehicleId/unlock', asyncAppWrapper((req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.unlock.push(command);
    match.extra.doorsLocked = false;
    match.extra.doorsLockedTimestamp = timestamp.now();
  });
}));

app.get('/api/fordconnect/vehicles/v1/:vehicleId/unlock/:commandId', asyncAppWrapper((req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.unlock, () => { });
}));

app.post('/api/fordconnect/vehicles/v1/:vehicleId/lock', asyncAppWrapper((req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.lock.push(command);
    match.extra.doorsLocked = true;
    match.extra.doorsLockedTimestamp = timestamp.now();
  });
}));

app.get('/api/fordconnect/vehicles/v1/:vehicleId/lock/:commandId', asyncAppWrapper((req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.lock, () => { });
}));

app.post('/api/fordconnect/vehicles/v1/:vehicleId/startEngine', asyncAppWrapper((req, res) => {
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
}));

app.get('/api/fordconnect/vehicles/v1/:vehicleId/startEngine/:commandId', asyncAppWrapper((req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.startEngine, () => { });
}));

app.post('/api/fordconnect/vehicles/v1/:vehicleId/stopEngine', asyncAppWrapper((req, res) => {
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
}));

app.get('/api/fordconnect/vehicles/v1/:vehicleId/stopEngine/:commandId', asyncAppWrapper((req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.stopEngine, () => { });
}));

app.post('/api/fordconnect/vehicles/v1/:vehicleId/wake', asyncAppWrapper((req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.wake.push(command);
    match.extra.lastWake = Date.now();
  });
}));

app.post('/api/fordconnect/vehicles/v1/:vehicleId/startCharge', asyncAppWrapper((req, res) => {
  vehicleIdPostMethod(req, res, true, (_req, _res, match, command) => {
    commands.startCharge.push(command);
    match.extra.lastStartCharge = Date.now();
  });
}));

app.post('/api/fordconnect/vehicles/v1/:vehicleId/stopCharge', asyncAppWrapper((req, res) => {
  vehicleIdPostMethod(req, res, true, (_req, _res, match, command) => {
    commands.stopCharge.push(command);
    match.extra.lastStopCharge = Date.now();
  });
}));

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

app.get('/api/fordconnect/vehicles/v1/:vehicleId/chargeSchedules', asyncAppWrapper((req, res) => {
  if (!isValidApplicationId(req)) {
    return sendInvalidApplicationId(req, res);
  }

  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    let nearbySchedule;

    if (match.evdata && (match.info && isEV(match.info.engineType))) {
      const matchLat = parseFloat(match.info.vehicleLocation.latitude);
      const matchLong = parseFloat(match.info.vehicleLocation.longitude);

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
    res.setHeader('Vehicleid', match.vehicle.vehicleId);
    return res.json(response);
  }

  return undefined; // getVehicleOrSendError send response.
}));

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
app.get('/api/fordconnect/vehicles/v1/:vehicleId/departureTimes', asyncAppWrapper((req, res) => {
  if (!isValidApplicationId(req)) {
    return sendInvalidApplicationId(req, res);
  }

  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    if (match.info && !isEV(match.info.engineType)) {
      return sendVehicleNotAuthorized(req, res, false, match.vehicle.vehicleId, true);
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
}));

app.post('/api/fordconnect/vehicles/v1/:vehicleId/status', asyncAppWrapper((req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    commands.status.push(command);
  });
}));

app.get('/api/fordconnect/vehicles/v1/:vehicleId/statusrefresh/:commandId', asyncAppWrapper((req, res) => {
  vehicleIdGetCommandStatus(req, res, commands.status, (_, __, match, command, response) => {
    if (command.commandStatus === 'COMPLETED') {
      let doorsLocked = match.extra.doorsLocked ? 'LOCKED' : 'UNLOCKED';
      if (match.extra.doorsLocked === undefined) {
        doorsLocked = 'ERROR';
      }

      const alarmEnabled = match.extra.alarmEnabled ? 'SET' : 'NOTSET';
      let alarmValue = match.extra.alarmTriggered ? 'ACTIVE' : alarmEnabled;
      if (match.extra.alarmTriggered === undefined) {
        alarmValue = 'ERROR';
      }
      response.vehiclestatus = {
        lockStatus: {
          timestamp: match.extra.doorsLockedTimestamp,
          value: doorsLocked,
        },
        alarm: {
          timestamp: match.extra.alarmTimestamp,
          value: alarmValue,
        },
      };
    }
  }, 202);
}));

app.get('/api/fordconnect/vehicles/v1/:vehicleId', asyncAppWrapper((req, res) => {
  if (!isValidApplicationId(req)) {
    return sendInvalidApplicationId(req, res);
  }

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
}));

app.post('/api/fordconnect/vehicles/v1/:vehicleId/location', asyncAppWrapper((req, res) => {
  vehicleIdPostMethod(req, res, false, (_req, _res, match, command) => {
    // NOTE: This commandId isn't used for anything by FordConnect API.
    commands.location.push(command);
  });
}));

app.get('/api/fordconnect/vehicles/v1/:vehicleId/location', asyncAppWrapper((req, res) => {
  if (!isValidApplicationId(req)) {
    return sendInvalidApplicationId(req, res);
  }

  if (isTokenExpired(req)) {
    return sendTokenExpiredJson(req, res);
  }

  const match = getVehicleOrSendError(req, res);
  if (match) {
    if (match.info && match.info.vehicleStatus) {
      const location = {
        status: 'SUCCESS',
        vehicleLocation: DeepCopy(match.info.vehicleLocation),
      };
      location.vehicleLocation.direction = location.vehicleLocation.direction.toUpperCase();
      res.setHeader('Vehicleid', match.vehicle.vehicleId);
      return res.json(location);
    }

    return sendVehicleNotAuthorized(req, res, false);
  }

  return undefined; // getVehicleOrSendError send response.
}));

app.get('/api/fordconnect/vehicles/v1/:vehicleId/images/full', asyncAppWrapper((req, res) => {
  vehicleIdGetImage(req, res, (match) => match.extra.image);
}));

app.get('/api/fordconnect/vehicles/v1/:vehicleId/images/thumbnail', asyncAppWrapper((req, res) => {
  vehicleIdGetImage(req, res, (match) => match.extra.imageThumbnail);
}));

// Set the simulator's today value (used for determining the next departure time.)
//
// param: day  (MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY)
// param: time (24-hour format, hh:mm, like 13:15 for 1:15PM)
// expected status: 200 (success), 400 (bad parameter)
//
// example query: /sim/today?day=FRIDAY&time=13:15
app.post('/sim/today', asyncAppWrapper((req, res) => {
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
}));

// Sets the tirePressureWarning on a vehicle.
//
// param: warning  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/psi/22221111111111151111111111112222?warning=true
app.post('/sim/psi/:vehicleId', asyncAppWrapper((req, res) => {
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
}));

// Sets the modem on a vehicle.
//
// param: enabled  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/modem/22221111111111151111111111112222?enabled=false
app.post('/sim/modem/:vehicleId', asyncAppWrapper((req, res) => {
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
}));

// Sets the deep sleep for the vehicle.
//
// param: sleep  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/deepsleep/22221111111111151111111111112222?sleep=false
app.post('/sim/deepsleep/:vehicleId', asyncAppWrapper((req, res) => {
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
}));

// Sets the firmwareUpgradeInProgess on a vehicle.
//
// param: upgrade  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/firmware/22221111111111151111111111112222?upgrade=true
app.post('/sim/firmware/:vehicleId', asyncAppWrapper((req, res) => {
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
}));

// Sets the plug status on an EV vehicle.
//
// param: connected  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/plug/22221111111111151111111111112222?connected=true
app.post('/sim/plug/:vehicleId', asyncAppWrapper((req, res) => {
  const { connected } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    if (!match.info || !isEV(match.info.engineType)) {
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
}));

// Sets the ignition status on the vehicle.
//
// param: value  (on/off)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/ignition/22221111111111151111111111112222?value=on
app.post('/sim/ignition/:vehicleId', asyncAppWrapper((req, res) => {
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
}));

// Sets the fuel level on an ICE vehicle.
//
// param: level  (0 to 100.0)
// param: dte (distance to empty, in km.)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/fuel/12341234123412341234123412341234?level=100.0&dte=700.0
app.post('/sim/fuel/:vehicleId', asyncAppWrapper((req, res) => {
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
}));

// Sets the battery level on an EV vehicle.
//
// param: level  (0 to 100.0)
// param: dte (distance to empty, in km.)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/battery/22221111111111151111111111112222?level=100.0&dte=400.0
app.post('/sim/battery/:vehicleId', asyncAppWrapper((req, res) => {
  const { level } = req.query;
  const { dte } = req.query;
  const match = getVehicleOrSendError(req, res);

  if (match) {
    if (!match.info || !isEV(match.info.engineType)) {
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
}));

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
app.post('/sim/location/:vehicleId', asyncAppWrapper((req, res) => {
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

    match.info.vehicleLocation.latitude = latitude.toFixed(6).toString();
    match.info.vehicleLocation.longitude = longitude.toFixed(6).toString();
    match.info.vehicleLocation.timeStamp = timestamp.now();
    match.info.vehicleDetails.mileage += distanceInMiles;
    match.info.vehicleDetails.odometer += (distanceInMiles * 1.609344);

    if (updatedSpeed !== undefined) {
      match.info.vehicleLocation.speed = updatedSpeed;
    }

    if (dir !== undefined) {
      match.info.vehicleLocation.direction = dir;
    }

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: 'Set location successfully.',
    });
  }

  return undefined;
}));

// Opens or closes a door on the vehicle.
//
// param: door  (HOOD_DOOR, REAR_LEFT, etc.)
// param: state (OPEN, CLOSED)
// param: role  (optional, if door is unique. DRIVER, PASSENGER, NOT_APPLICABLE)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query:
//  /sim/door/22221111111111151111111111112222?door=UNSPECIFIED_FRONT&role=DRIVER&state=OPEN
app.post('/sim/door/:vehicleId', asyncAppWrapper((req, res) => {
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
}));

// Sets the alarm for the vehicle.
//
// param: state  (enabled, disabled, triggered, error)
// deprecated param: enabled  (true/false)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/alarm/22221111111111151111111111112222?state=enabled
app.post('/sim/alarm/:vehicleId', asyncAppWrapper((req, res) => {
  let { state } = req.query;
  const { enabled } = req.query;
  const setting = toBoolean(enabled);
  if (setting !== undefined) {
    state = setting ? 'enabled' : 'disabled';
  } else if (state !== undefined) {
    state = state.toLowerCase();
    if (state !== 'enabled' && state !== 'disabled' && state !== 'triggered' && state !== 'error') {
      state = undefined;
    }
  }

  const match = getVehicleOrSendError(req, res);

  if (match) {
    if (state === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'state\' must be (enabled, disabled, triggered, error).',
      });
    }

    match.extra.alarmEnabled = state === 'enabled' || state === 'triggered';
    match.extra.alarmTriggered = state === 'triggered';
    if (state === 'error') {
      match.extra.alarmEnabled = undefined;
      match.extra.alarmTriggered = undefined;
    }
    match.extra.alarmTimestamp = timestamp.now();

    res.statusCode = 200;
    return res.json({
      status: 'SUCCESS',
      msg: `Alarm set to ${state} successfully.`,
    });
  }

  return undefined;
}));

// Sets the door locks for the vehicle.
//
// param: state  (locked, unlocked, error)
// expected status: 200 (success), 400 (bad parameter), 4xx (bad vehicleId)
//
// example query: /sim/locks/22221111111111151111111111112222?state=error
app.post('/sim/locks/:vehicleId', asyncAppWrapper((req, res) => {
  let { state } = req.query;
  if (state !== undefined) {
    state = state.toLowerCase();
    if (state !== 'locked' && state !== 'unlocked' && state !== 'error') {
      state = undefined;
    }
  }

  const match = getVehicleOrSendError(req, res);

  if (match) {
    if (state === undefined) {
      res.statusCode = 400;
      return res.json({
        status: 'ERROR',
        msg: 'parameter \'state\' must be (locked, unlocked, error).',
      });
    }

    match.extra.doorsLocked = state === 'locked';
    if (state === 'error') {
      match.extra.doorsLocked = undefined;
    }
    match.extra.doorsLockedTimestamp = timestamp.now();

    res.statusCode = 200;
    return res.json({
      msg: `Alarm set to ${state} successfully.`,
      status: 'SUCCESS',
    });
  }

  return undefined;
}));

async function clone(req, res) {
  const clones = [];

  // Get vehicleList
  const response = await getVehicles();
  if (response.statusCode !== 200 || response.body.status !== 'SUCCESS') {
    res.statusCode = 418;
    return res.json({
      status: 'FAILED',
      msg: `Failed to get list of vehicles.  statusCode was ${response.statusCode} with status ${response.body.status}.`,
    });
  }
  const vehicleList = response.body.vehicles;

  // For each vehicle
  for (let i = 0; i < vehicleList.length; i += 1) {
    // initial data is iceN or evN.
    const paramVehicle = vehicleList[i];

    // extract vehicleId
    const { vehicleId } = vehicleList[i];

    if (paramVehicle.vehicleAuthorizationIndicator) {
      // eslint-disable-next-line no-await-in-loop
      let requests = [
        // get details, data is iceN_info.
        getDetails(vehicleId),
        // get full image and save in image\{vehicleId-full.png}
        imageFull(vehicleId),
        // get thumbnail image and save in image\{vehicleId-thumb.png}
        imageThumbnail(vehicleId),
      ];
      // eslint-disable-next-line no-await-in-loop
      let answers = await Promise.all(requests);

      for (let j = 0; j < requests.length; j += 1) {
        if (answers[j].statusCode !== 200) {
          res.statusCode = 418;
          return res.json({
            status: 'FAILED',
            msg: `Failed to get data (${j}) for ${vehicleId}.  statusCode was ${answers[j].statusCode} with status ${answers[j].body.status}.`,
          });
        }
      }

      const paramDetails = answers[0].body;

      let streamFull = createWriteStream(`images\\${vehicleId}-full.png`, { encoding: 'binary' });
      streamFull.write(answers[1].body);
      streamFull.end();

      streamFull = createWriteStream(`images\\${vehicleId}-thumb.png`, { encoding: 'binary' });
      streamFull.write(answers[2].body);
      streamFull.end();
      // TODO: Wait for the finish events of both files.

      // If isEV then
      if (isEV(paramDetails.engineType)) {
        requests = [
          // getDepartureTimes (NOTE: We can only get next departure time, not ALL of them.)
          getDepartureTimes(vehicleId),
          // getChargeSchedules (NOTE: We can only get for the current location, not all locations.)
          getChargeSchedule(vehicleId),
        ];

        // eslint-disable-next-line no-await-in-loop
        answers = await Promise.all(requests);

        for (let j = 0; j < requests.length; j += 1) {
          if (answers[j].statusCode !== 200 || answers[j].body.status !== 'SUCCESS') {
            res.statusCode = 418;
            return res.json({
              status: 'FAILED',
              msg: `Failed to get ev data (${j}) for ${vehicleId}.  statusCode was ${answers[j].statusCode} with status ${answers[j].body.status}.`,
            });
          }
        }

        // reformat the data (hh:mm)
        const departures = answers[0].body; // TODO: Reformat.

        // augment the data (lat, long, name, desiredChargeLevel)
        const schedules = answers[1].body; // TODO: Augment.

        console.log('* CREATE EV *');
        console.log(vehicleId);
        console.log(paramVehicle);
        console.log(departures);
        console.log(schedules);
        console.log(paramDetails);
        clones.push({ kind: paramDetails.vehicle.engineType, vehicleId });
      } else {
        console.log(`* CREATED ICE ${vehicleId} *`);
        vehicles.push({
          vehicle: paramVehicle,
          info: paramDetails.vehicle,
          extra: makeExtra(`${vehicleId}-full.png`, `${vehicleId}-thumb.png`),
        });
        clones.push({ kind: paramDetails.vehicle.engineType, vehicleId });
      }
    } else {
      console.log(`* CREATED UNAUTH ${vehicleId} *`);
      vehicles.push({
        vehicle: paramVehicle,
        info: undefined,
        extra: makeExtra('full-image.png', 'thumbnail.png'),
      });
      clones.push({ kind: 'UNAUTH', vehicleId });
    }
  }

  res.statusCode = 200;
  return res.json({
    msg: clones,
    status: 'SUCCESS',
  });
}

// Clones the FordConnect API for a given refresh token.
//
// body: [refresh_token] Your real FordConnect API refresh token.
// expected status: 200 (success), 400 (bad parameter)
app.post('/sim/clone', asyncAppWrapper(async (req, res) => {
  const actualRefreshToken = req.fields['refresh_token'];
  if (actualRefreshToken === undefined) {
    res.statusCode = 400;
    return res.json({
      msg: 'Missing refresh_token POST parameter',
      status: 'FAILED',
    });
  }

  // Use refreshToken to get an access token.
  await refreshToken(getAccessTokenTimeout(), actualRefreshToken);

  return clone(req, res);
}));

// Returns the simulators current vehicle model.
//
// expected status: 200 (success)
app.get('/sim', asyncAppWrapper((req, res) => {
  res.statusCode = 200;
  res.json(vehicles);
}));

const app3000 = express();

// Ccreate a PFX cert file in Windows by downloading the tool at...
// https://www.pluralsight.com/blog/software-development/selfcert-create-a-self-signed-certificate-interactively-gui-or-programmatically-in-net
//
try {
  const certPfx = fs.readFileSync('./cert.pfx');
  const options3000 = {
    pfx: certPfx,
    passphrase: process.env.FORDSIM_PASSPHRASE,
  };
  const httpServer3000 = https.createServer(options3000, app3000);
  if (process.env.NODE_ENV !== 'test') {
    httpServer3000.listen(3000);
    console.log('Also listening on port 3000!');
  }

  // This route shuts down the listener on port 3000.  If your application requires port 3000,
  // then once the simulator is populated, you can use this route to shut down the listener
  // for cloning cars.  You can still use the port 80 and the /sim/clone route if you need to
  // import additional vehicles.
  app3000.get('/quit', (req, res) => {
    httpServer3000.close();
    res.send('Server on port 3000 is shut down.');
  });
} catch (err) {
  console.log(`Error starting HTTPS server. ${err}`);
}

async function showSimulatorSummary(req, res, vehicleList) {
  let title = 'Your vehicles are cloned';

  if (vehicleList === undefined) {
    title = 'Here are your active vehicles.';

    vehicleList = vehicles.map((v) => v.vehicle);
  }

  const authVehicleList = vehicleList.filter((v) => v.vehicleAuthorizationIndicator);

  // Create a new code and reset the timer on the code.
  const newCode = `Code${makeGuid()}`;
  codeExpireTimestamp = Date.now() + getCodeTimeout() * 1000;

  // If code was wildcard, don't reset it.
  if (code !== '*') {
    code = newCode;
  }

  let msg = `<html><head><title>${title}</title>`;
  msg += '<style>body{font-family:Tahoma,Geneva,sans-serif;color:#0276B3;}'
  + '.code{background-color:#ffff92;}.vid{background-color:#e8f0fe;}'
  + '.line{margin-top:25px;}.warn{color:#000;background-color:#ffc7e3;}'
  + 'table{font-size:25px;}h2{margin-top: 5px;margin-bottom: 0px;}'
  + `</style></head><body><center><h1>${title}</h1>`
  + '<h2>The simulator&apos;s authorization code is :</h2>'
  + `<h2><span class="code">${newCode}</span></h2>`;
  for (let i = 0; i < authVehicleList.length; i += 1) {
    const veh = vehicles.find((v) => v.vehicle.vehicleId === authVehicleList[i].vehicleId);

    const circle = 'https://raw.githubusercontent.com/jamisonderek/ford-connect-sim/main/images/circle.png';
    let icon = 'data:image/jpeg;base64,';
    const filename = `.\\images\\${veh.extra.imageThumbnail}`;
    try {
      icon += fs.readFileSync(filename, 'base64');
    } catch (e) {
      console.error(`ERROR WITH THUMBNAIL:  ${e}`);
      icon = undefined;
    }
    let { make } = veh.vehicle;
    if (make === 'F') {
      make = 'Ford';
    }
    if (make === 'L') {
      make = 'Lincoln';
    }
    const lockMsg = veh.extra.doorsLocked ? 'Locked' : 'Unlocked';
    const lockClass = veh.extra.doorsLocked ? 'data' : 'data warn';
    const openDoors = veh.info.vehicleStatus.doorStatus.filter((d) => d.value !== 'CLOSED');
    let openDoorNames = openDoors.map((d) => ((d.vehicleDoor === 'UNSPECIFIED_FRONT') ? d.vehicleOccupantRole : d.vehicleDoor)).join(',');
    if (openDoors.length === 0) {
      openDoorNames = 'None';
    }
    const openClass = (openDoors.length === 0) ? 'data' : 'data warn';
    const carTop = isEV(veh.info.engineType) ? -270 : -233;

    msg += `<h2 class="line">Vehicle id: <span class="vid">${veh.vehicle.vehicleId}</span></h2>`;
    const engineType = veh.info.engineType === 'ICE' ? 'ICE (Internal Combustion Engine)' : veh.info.engineType;
    msg += `<table border=1><tr><td class="label">Engine type</td><td class="data">${engineType}</td></tr>`;
    msg += `<tr><td class="label">Make</td><td class="data">${make}</td></tr>`;
    msg += `<tr><td class="label">Model</td><td class="data">${veh.vehicle.modelYear} ${veh.vehicle.modelName}</td></tr>`;
    const fuelPercent = veh.info.vehicleDetails.fuelLevel.value;
    const fuelKm = veh.info.vehicleDetails.fuelLevel.distanceToEmpty;
    const fuelMi = (parseFloat(fuelKm) / 1.61).toFixed(1);
    msg += `<tr><td class="label">Fuel</td><td class="data">${fuelPercent}% (DTE: ${fuelKm}km/${fuelMi}mi)</td></tr>`;
    msg += `<tr><td class="label">Doors</td><td class="${lockClass}">${lockMsg}</td></tr>`;
    msg += `<tr><td class="label">Open doors</td><td class="${openClass}">${openDoorNames}</td></tr>`;
    if (isEV(veh.info.engineType)) {
      const batteryPercent = veh.info.vehicleDetails.batteryChargeLevel.value;
      const batteryKm = veh.info.vehicleDetails.batteryChargeLevel.distanceToEmpty;
      const batteryMi = (parseFloat(batteryKm) / 1.61).toFixed(1);
      const batteryClass = batteryMi > 50 ? 'data' : 'data warn';
      const chargeClass = 'data';
      let chargeMsg = veh.info.vehicleStatus.plugStatus.value ? 'Plugged in ' : 'Not plugged in ';
      chargeMsg += `(${veh.info.vehicleStatus.chargingStatus.value})`;
      msg += `<tr><td class="label">EV Battery</td><td class="${batteryClass}">${batteryPercent}% (DTE: ${batteryKm}km/${batteryMi}mi)</td></tr>`;
      msg += `<tr><td class="label">EV Charger</td><td class="${chargeClass}">${chargeMsg}</td></tr>`;
    }
    const lat = veh.info.vehicleLocation.latitude;
    const lon = veh.info.vehicleLocation.longitude;
    msg += `<tr><td class="label">Latitude</td><td class="data">${lat}</td></tr>`;
    msg += `<tr><td class="label">Longitude</td><td><div class="data" style="display:inline-block">${lon}</div><div style="float: right">`;
    msg += `<a href="https://www.bing.com/maps?cp=${lat}~${lon}&sty=r&lvl=17&FORM=MBEDLD" target="blank">Open map</a></div></td></tr>`;
    msg += '<tr><td colspan=2><div style="height:400px; position:relative">';
    msg += '<iframe style="z-index:1" width="500" height="400" frameborder="0" src="https://www.bing.com/maps/embed?h=400&w=500&';
    msg += `cp=${lat}~${lon}&lvl=17&typ=s&sty=r&src=SHELL&FORM=MBEDV8" scrolling="no"></iframe>`;
    msg += `<img alt="circle showing where vehicle is located" style="top:120px; right:200px; position:absolute; z-index:2" width="150" height="150" src="${circle}">`;
    if (icon !== undefined) {
      msg += `<img alt="picture of ${make} ${veh.vehicle.modelName}" style="top:${carTop}; right:30px; position:absolute; z-index:-2; opacity:0.1" width="320" src="${icon}">`;
    }
    msg += '</div></td></tr></table><p>';
  }

  msg += '</center></body></html>';

  res.statusCode = 200;
  return res.send(msg);
}

// This route gets called by the auth callback.  It will clone the vehicles.
//
// expected status: 200 (success) ,400 (bad code), 418 (failed getting data)
app3000.get('/', asyncAppWrapper(async (req, res) => {
  const authCode = req.query.code;

  await updateTokenFromCode(authCode);
  await refreshToken(getAccessTokenTimeout(), undefined);

  const response = await getVehicles();
  if (response.statusCode !== 200 || response.body.status !== 'SUCCESS') {
    res.statusCode = 418;
    return res.send(`Failed to get list of vehicles.  statusCode was ${response.statusCode}.`);
  }
  const vehicleList = response.body.vehicles;

  const clonedRes = {
    statusCode: 0,
    json: () => { },
  };
  await clone(req, clonedRes);
  if (clonedRes.statusCode !== 200) {
    res.statusCode = clonedRes.statusCode;
    return res.send(`Failed to clone vehicles.  statusCode was ${clonedRes.statusCode}`);
  }

  const authVehicleList = vehicleList.filter((v) => v.vehicleAuthorizationIndicator);
  if (authVehicleList.length === 0) {
    res.statusCode = 418;
    return res.send('No authorized vehicles cloned.');
  }

  return showSimulatorSummary(req, res, vehicleList);
}));

app.get('/sim/html', asyncAppWrapper((req, res) => showSimulatorSummary(req, res, undefined)));

app.use((req, res) => {
  res.status(404).send('The route you requested is not supported by this simulator. Verify GET/POST usage and path.');
});

app3000.use((req, res) => {
  res.status(404).send('The https route you requested is not supported.');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  // SECURITY: We are showing potentially user controlled data and potentially internal data.
  // TODO: Replace with logging API and just return 'friendly message'.
  res.status(500).send(`<pre>Unhandled error, please report the following stacktrace at https://github.com/jamisonderek/ford-connect-sim/issues!\n\n${err.stack}</pre>`);
});

// eslint-disable-next-line no-unused-vars
app3000.use((err, req, res, next) => {
  console.error(err.stack);
  // SECURITY: We are showing potentially user controlled data and potentially internal data.
  // TODO: Replace with logging API and just return 'friendly message'.
  res.status(500).send(`<pre>Unhandled error, please report the following stacktrace at https://github.com/jamisonderek/ford-connect-sim/issues!\n\n${err.stack}</pre>`);
});

exports.server = app;
exports.vehicleData = vehicles;
exports.today = today;
