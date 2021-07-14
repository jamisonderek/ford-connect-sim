/* eslint-disable linebreak-style */
/* eslint-disable no-console */

/**
 * FordConnect.js exports a bunch of functions for interacting with the FordConnect API.
 *
 * FordConnect.js supports the following environment variables:
 *
 *   FORD_CLIENTSECRET environment variable is the secret value for connecting
 *   to the endpoint.  This value must be set (see your Postman environment variable
 *   for the correct value).
 *
 *   FORD_CODE environment variable is the Access code used in the first step of
 *   the oauth authentication.
 *
 *   FORD_REFRESH environment variable is a refresh access token to use in the second
 *   set of the oauth authentication.  If it is not set, then the refresh token value
 *   returned by the first oauth call will be used.
 *
 *   FORDSIM_NGROK environment variable is the domain name of your ngrok server
 *   hosting the simulator.  If it is not set, then the FordConnect API server
 *   (*.ford.com) will be used instead.
 *
 */

const { post, get, jsonToFormData } = require('./web');
const { clientId, clientSecret, applicationId } = require('./settings');
const { oauthhostname, hostname, port } = require('./settings');

/**
 * api-version header value to send on all calls.
 */
const apiversion = '2020-06-01';

/**
 * The maximum number of retries to do for a 'PENDINGRESPONSE'
 */
const maxRetryCount = 10;

/**
 * The sleep duration between retries.
 */
const retryDuration = 2000;

/**
 * This is the token used for accessing the FordConnect APIs.
 */
const token = {
  accessToken: '',
  expiresOn: 1577836800, // Expired. Jan 1, 2020.
  refreshToken: process.env.FORD_REFRESH,
};

/**
 * Internal. Function for updating the token.
 * @param {*} data A string of form data to post to the oauth endpoint.
 * @returns Boolean. true if the token was updated.
 */
async function $updateToken(data) {
  const options = {
    hostname: oauthhostname,
    port,
    path: '/914d88b1-3523-4bf6-9be4-1b96b4f6f919/oauth2/v2.0/token?p=B2C_1A_signup_signin_common',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': data.length,
    },
  };

  const response = await post(data, options);

  const json = JSON.parse(response.body);
  if (json.error) {
    // TODO: Use a logging framework.
    console.log(response.body);
    return false;
  }

  if (!json.access_token) {
    // TODO: Use a logging framework.
    console.log(`Unexpected response: ${JSON.stringify(response)}`);
    return false;
  }

  // Update our token information with the response.
  token.accessToken = json.access_token;
  token.expiresOn = json.expires_on;
  token.refreshToken = json.refresh_token;

  // TODO: Use a logging framework.
  console.log('Updated access and refresh tokens.');
  return true;
}

/**
 * Updates our token using the authorization code.
 *
 * @param {*} authCode The code to pass to oauth.  If undefined then
 * FORD_CODE environment variable will be used instead.
 * @returns Boolean. true if the token was updated.
 */
async function updateTokenFromCode(authCode) {
  if (authCode === undefined) {
    // eslint-disable-next-line no-param-reassign
    authCode = process.env.FORD_CODE;
  }

  const data = jsonToFormData({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: authCode,
    redirect_uri: 'https%3A%2F%2Flocalhost%3A3000',
  });

  return $updateToken(data);
}

/**
 * If our token is about to expire, then this will update our token using the refresh token.
 *
 * NOTE: When the service started, it initialized the refresh token with the FORD_REFRESH
 * environment variable value.  Every time the access token in updated, the refresh token
 * also gets updated with the latest value.
 *
 * @param {*} duration The number of seconds the token must be good for.  If undefined then
 * the refresh will happen regardless of the token expiration.
 * @param {*} specialRefreshToken A specific refresh token to use.  If undefined then the last know
 * refresh token will be used.
 *
 * @returns Boolean. true if the token was updated.
 */
async function refreshToken(duration, specialRefreshToken) {
  if (duration === undefined || (token.expiresOn - Date.now() / 1000) < duration) {
    const data = jsonToFormData({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: (specialRefreshToken !== undefined) ? specialRefreshToken : token.refreshToken,
    });

    return $updateToken(data);
  }

  return false;
}

/**
 * GET /api/fordconnect/vehicles/v1
 * Gets the list of vehicles associated with the account.
 *
 * @returns Response.
 */
async function getVehicles() {
  const options = {
    hostname,
    port,
    path: '/api/fordconnect/vehicles/v1',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-version': apiversion,
      'Application-id': applicationId,
      Authorization: `Bearer ${token.accessToken}`,
    },
  };

  const response = await get(options);

  // Convert the body from a JSON string into an object.
  if (response.body) {
    response.body = JSON.parse(response.body);
  }

  return response;
}

/**
 * Internal. Sleeps for the desired number of miliseconds when you await the response.
 * @param {*} ms The duration in milliseconds.
 * @returns Promise. calling await will block until the duration occurs.
 */
function $sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Internal. GET commandStatus responses.  If the response is PENDINGRESPONSE then
 * the call will be retried for up to maxRetryCount, with a delay of retryDuration
 * between retries.
 *
 * @param {*} options The options for the request (should include hostname, port, path, method.)
 * @returns Response.
 */
async function $retryGetWhilePending(options) {
  let response;
  let retryCount = maxRetryCount;
  // eslint-disable-next-line no-plusplus
  while (retryCount-- > 0) {
    // Since this is a retry loop we want to await each call (to see if it succeeded.)
    // eslint-disable-next-line no-await-in-loop
    response = await get(options);
    if (response.body) {
      // Convert the body from a JSON string into an object.
      response.body = JSON.parse(response.body);
      // TODO: Use a logging framework.
      console.log(`status was ${response.body.commandStatus}`);
      if (response.body.commandStatus !== 'PENDINGRESPONSE') {
        return response;
      }
      // We want a delay in the loop, so there is better chance retry will work.
      // eslint-disable-next-line no-await-in-loop
      await $sleep(retryDuration);
    } else {
      return response;
    }
  }

  // We exceeded our timeout, so return the PENDINGRESPONSE data.
  return response;
}

/**
 * Internal. Executes a POST for the command.
 *
 * @param {*} vehicleId The vehicleId to perform the command on.
 * @param {*} command The command to perform (must be a valid route.)
 * @returns Response.
 */
async function $doCommand(vehicleId, command) {
  const options = {
    hostname,
    port,
    path: `/api/fordconnect/vehicles/v1/${vehicleId}/${command}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-version': apiversion,
      'Application-id': applicationId,
      Authorization: `Bearer ${token.accessToken}`,
    },
  };

  const response = await get(options);

  if (response.body) {
    // Convert the body from a JSON string into an object.
    response.body = JSON.parse(response.body);
  }

  return response;
}

/**
 * Internal. Executes a GET to check the status of a previous command.  If the response is
 * PENDINGRESPONSE then the call will be retried for up to maxRetryCount, with a
 * delay of retryDuration between retries.
 *
 * @param {*} vehicleId The vehicleId the command was performed on.
 * @param {*} command The command that was performed.
 * @param {*} commandId The commandId that was returned by a previous doCommand.
 * @returns Response.
 */
async function $checkCommand(vehicleId, command, commandId) {
  const options = {
    hostname,
    port,
    path: `/api/fordconnect/vehicles/v1/${vehicleId}/${command}/${commandId}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-version': apiversion,
      'Application-id': applicationId,
      Authorization: `Bearer ${token.accessToken}`,
    },
  };

  return $retryGetWhilePending(options);
}

/**
 * Internal. Executes a GET for the command.  There is no retry as these routes should return data.
 * @param {*} vehicleId The vehicleId to perform the query on.
 * @param {*} command The command to perform (must be a valid route.)  If undefined, then details
 * about the vehicle will be returned.
 * @returns Response.
 */
async function $getInfo(vehicleId, command) {
  const uri = (command === undefined)
    ? `/api/fordconnect/vehicles/v1/${vehicleId}` : `/api/fordconnect/vehicles/v1/${vehicleId}/${command}`;

  const options = {
    hostname,
    port,
    path: uri,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-version': apiversion,
      'Application-id': applicationId,
      Authorization: `Bearer ${token.accessToken}`,
    },
  };

  const response = await get(options);

  if (response.body) {
    // Convert the body from a JSON string into an object.
    response.body = JSON.parse(response.body);
  }

  return response;
}

/**
 * Internal. Returns a binary file (like an image).
 * @param {*} vehicleId The vehicleId to request an image of.
 * @param {*} size the size to request ('thumbnail' or 'full').
 * @returns Response.
 */
async function $getImage(vehicleId, size) {
  // The query params need to be valid, but don't seem to impact the results?
  const queryParams = 'make=Ford&model=&year=2019';
  const options = {
    hostname,
    port,
    path: `/api/fordconnect/vehicles/v1/${vehicleId}/images/${size}?${queryParams}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: '*/*',
      'api-version': apiversion,
      'Application-id': applicationId,
      Authorization: `Bearer ${token.accessToken}`,
    },
  };

  const response = await get(options, 'binary');
  return response;
}

/**
 * POST /api/fordconnect/vehicles/v1/${vehicleId}/unlock
 * @param {*} vehicleId The vehicleId of the vehicle to unlock.
 * @returns Response.
 */
async function doUnlock(vehicleId) {
  return $doCommand(vehicleId, 'unlock');
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}/unlock/${commandId}
 * @param {*} vehicleId The vehicleId.
 * @param {*} commandId The commandId returned from doUnlock.
 * @returns Response.
 */
async function checkUnlock(vehicleId, commandId) {
  return $checkCommand(vehicleId, 'unlock', commandId);
}

/**
 * POST /api/fordconnect/vehicles/v1/${vehicleId}/lock
 * @param {*} vehicleId The vehicleId of the vehicle to lock.
 * @returns Response.
 */
async function doLock(vehicleId) {
  return $doCommand(vehicleId, 'lock');
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}/lock/${commandId}
 * @param {*} vehicleId The vehicleId.
 * @param {*} commandId The commandId returned from doLock.
 * @returns Response.
 */
async function checkLock(vehicleId, commandId) {
  return $checkCommand(vehicleId, 'lock', commandId);
}

/**
 * POST /api/fordconnect/vehicles/v1/${vehicleId}/startEngine
 * @param {*} vehicleId The vehicleId of the vehicle to start.
 * @returns Response.
 */
async function doStartEngine(vehicleId) {
  return $doCommand(vehicleId, 'startEngine');
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}/startEngine/${commandId}
 * @param {*} vehicleId The vehicleId.
 * @param {*} commandId The commandId returned from doStartEngine.
 * @returns Response.
 */
async function checkStartEngine(vehicleId, commandId) {
  return $checkCommand(vehicleId, 'startEngine', commandId);
}

/**
 * POST /api/fordconnect/vehicles/v1/${vehicleId}/stopEngine
 * @param {*} vehicleId The vehicleId of the vehicle to stop.
 * @returns Response.
 */
async function doStopEngine(vehicleId) {
  return $doCommand(vehicleId, 'stopEngine');
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}/stopEngine/${commandId}
 * @param {*} vehicleId The vehicleId.
 * @param {*} commandId The commandId returned from doStopEngine.
 * @returns Response.
 */
async function checkStopEngine(vehicleId, commandId) {
  return $checkCommand(vehicleId, 'stopEngine', commandId);
}

/**
 * POST /api/fordconnect/vehicles/v1/${vehicleId}/wake
 * @param {*} vehicleId The vehicleId of the vehicle to wake (14 day deep sleep reset).
 * @returns Response.
 */
async function doWake(vehicleId) {
  return $doCommand(vehicleId, 'wake');
}

/**
 * POST /api/fordconnect/vehicles/v1/${vehicleId}/startCharge
 * @param {*} vehicleId The vehicleId of the vehicle to start charging.
 * @returns Response.
 */
async function doStartCharge(vehicleId) {
  return $doCommand(vehicleId, 'startCharge');
}

/**
 * POST /api/fordconnect/vehicles/v1/${vehicleId}/stopCharge
 * @param {*} vehicleId The vehicleId of the vehicle to stop charging.
 * @returns Response.
 */
async function doStopCharge(vehicleId) {
  return $doCommand(vehicleId, 'stopCharge');
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}/chargeSchedules
 * @param {*} vehicleId The vehicleId of the EV vehicle to get charging schedule.
 * @returns Response.
 */
async function getChargeSchedule(vehicleId) {
  return $getInfo(vehicleId, 'chargeSchedules');
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}/departureTimes
 * @param {*} vehicleId The vehicleId of the EV vehicle to get departure times.
 * @returns Response.
 */
async function getDepartureTimes(vehicleId) {
  return $getInfo(vehicleId, 'departureTimes');
}

/**
 * POST /api/fordconnect/vehicles/v1/${vehicleId}/status
 * @param {*} vehicleId The vehicleId of the vehicle to get updated status.
 * @returns Response.
 */
async function doStatus(vehicleId) {
  return $doCommand(vehicleId, 'status');
}

async function getStatus(vehicleId, commandId) {
  // This follows the checkCommand format, but you get back
  // actual data, so it's similar to the get versions.
  return $checkCommand(vehicleId, 'statusrefresh', commandId);
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}
 * @param {*} vehicleId The vehicleId of the vehicle to get details of.
 * @returns Response.
 */
async function getDetails(vehicleId) {
  return $getInfo(vehicleId);
}

/**
 * POST /api/fordconnect/vehicles/v1/${vehicleId}/location
 * @param {*} vehicleId The vehicleId of the vehicle to get updated location data.
 * @returns Response.
 */
async function doLocation(vehicleId) {
  return $doCommand(vehicleId, 'location');
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}/location
 * @param {*} vehicleId The vehicleId of the vehicle to location information.
 * @returns Response.
 */
async function getLocation(vehicleId) {
  return $getInfo(vehicleId, 'location');
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}/images/thumbnail?$make=Ford&model=&year=2019
 * @param {*} vehicleId The vehicleId of the vehicle to get the image of.
 * @returns Response.
 */
async function imageThumbnail(vehicleId) {
  return $getImage(vehicleId, 'thumbnail');
}

/**
 * GET /api/fordconnect/vehicles/v1/${vehicleId}/images/full?$make=Ford&model=&year=2019
 * @param {*} vehicleId The vehicleId of the vehicle to get the image of.
 * @returns Response.
 */
async function imageFull(vehicleId) {
  return $getImage(vehicleId, 'full');
}

// updateTokenFromCode and refreshToken do authorization.
exports.updateTokenFromCode = updateTokenFromCode;
exports.refreshToken = refreshToken;

// getVehicles return list of vehicles.
exports.getVehicles = getVehicles;

// Commands with doXXX + checkXXX to see that command worked.
exports.doUnlock = doUnlock;
exports.checkUnlock = checkUnlock;
exports.doLock = doLock;
exports.checkLock = checkLock;
exports.doStartEngine = doStartEngine;
exports.checkStartEngine = checkStartEngine;
exports.doStopEngine = doStopEngine;
exports.checkStopEngine = checkStopEngine;

// doWake will wake up system (there is no check).
exports.doWake = doWake;

// charging actions return result (there is no check).
exports.doStartCharge = doStartCharge;
exports.doStopCharge = doStopCharge;
exports.getChargeSchedule = getChargeSchedule;
exports.getDepartureTimes = getDepartureTimes;

// doStatus + checkStatus gives back data.
exports.doStatus = doStatus;
exports.getStatus = getStatus;

exports.getDetails = getDetails;

// doLocation + getLocation gives back loocation data.
exports.doLocation = doLocation;
exports.getLocation = getLocation;

// imageThumbnail or imageFull returns image data.
exports.imageThumbnail = imageThumbnail;
exports.imageFull = imageFull;
