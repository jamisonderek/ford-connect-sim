/* eslint-disable linebreak-style */
/* eslint-disable no-console */

/**
 * Demo.js is a demo of using the various FordConnect methods.
 *
 * The easiest way to run this is...
 *   const { demo } = require('./fordConnect/demo');
 *   demo().catch((err) => console.error(`An error occurred: ${err}`));
 */

const { createWriteStream } = require('fs');

const {
  updateTokenFromCode,
  refreshToken,
  getVehicles,
  doUnlock,
  checkUnlock,
  doLock,
  checkLock,
  doStartEngine,
  checkStartEngine,
  doStopEngine,
  checkStopEngine,
  doWake,
  doStartCharge,
  doStopCharge,
  getChargeSchedule,
  getDepartureTimes,
  doStatus,
  getStatus,
  getDetails,
  doLocation,
  getLocation,
  imageThumbnail,
  imageFull,
} = require('./fordConnect');

async function demo() {
  // Demo getting a token from Code.  We don't pass a code, so the FORD_CODE environment
  // variable will be used instead.
  await updateTokenFromCode();

  // Demo refreshing our token.
  await refreshToken();

  // Demo refreshing our token it it expires in next 5 minutes (which it doesn't).
  await refreshToken(5 * 60);

  // Demo getting a list of vehicles
  const vehicles = await getVehicles();
  console.log(vehicles);
  console.log(JSON.stringify(vehicles.body.vehicles));

  // Grab the first vehicle that we have authorized.
  const { vehicleId } = vehicles.body.vehicles.filter(
    (v) => v.vehicleAuthorizationIndicator === 1,
  )[0];
  console.log(vehicleId);

  let response;

  // Demo EV - starting the charge
  console.log('doStartCharge');
  response = await doStartCharge(vehicleId);
  console.log(response);

  // Demo EV - stopping the charge
  console.log('doStopCharge');
  response = await doStopCharge(vehicleId);
  console.log(response);

  // Demo EV - get the charge schedule
  console.log('getChargeSchedule');
  response = await getChargeSchedule(vehicleId);
  console.log(response);

  // Demo EV - get the departure times
  console.log('getDepartureTimes');
  response = await getDepartureTimes(vehicleId);
  console.log(response);

  // Demo unlocking the doors
  console.log('doUnlock');
  response = await doUnlock(vehicleId);
  let { commandId } = response.body;
  console.log(commandId);
  response = await checkUnlock(vehicleId, commandId);
  console.log(response);

  // Demo starting the engine
  console.log('doStartEngine');
  response = await doStartEngine(vehicleId);
  ({ commandId } = response.body);
  console.log(commandId);
  response = await checkStartEngine(vehicleId, commandId);
  console.log(response);

  // Demo locking the doors
  console.log('doLock');
  response = await doLock(vehicleId);
  ({ commandId } = response.body);
  console.log(commandId);
  response = await checkLock(vehicleId, commandId);
  console.log(response);

  // Demo stopping the engine
  console.log('doStopEngine');
  response = await doStopEngine(vehicleId);
  ({ commandId } = response.body);
  console.log(commandId);
  response = await checkStopEngine(vehicleId, commandId);
  console.log(response);

  // Demo waking the car (resetting the 14 day sleep window)
  console.log('doWake');
  response = await doWake(vehicleId);
  ({ commandId } = response.body);
  console.log(commandId);

  // Demo getting status (door locks & alarm)
  console.log('doStatus');
  response = await doStatus(vehicleId);
  ({ commandId } = response.body);
  console.log(commandId);
  response = await getStatus(vehicleId, commandId);
  console.log(response);
  console.log(response.body.vehiclestatus);

  // Demo getting location data
  console.log('doLocation');
  response = await doLocation(vehicleId);
  ({ commandId } = response.body);
  console.log(commandId);
  response = await getLocation(vehicleId);
  console.log(response);
  console.log(response.body.vehicleLocation);

  // Demo getting an image thumbnail.
  console.log('imageThumbnail');
  response = await imageThumbnail(vehicleId);
  // Store it in our images folder.
  const stream = createWriteStream(`images\\${vehicleId}-thumb.png`, { encoding: 'binary' });
  stream.write(response.body);
  stream.end();

  // Demo getting a full image.
  console.log('imageFull');
  response = await imageFull(vehicleId);
  // Store it in our images folder.
  const streamFull = createWriteStream(`images\\${vehicleId}-full.png`, { encoding: 'binary' });
  streamFull.write(response.body);
  streamFull.end();

  // Demo getting vehicle details.
  console.log('getDetails');
  response = await getDetails(vehicleId);
  console.log(response);
  console.log(JSON.stringify(response));

  console.log('done.');
}

exports.demo = demo;
