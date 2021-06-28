/* eslint-disable linebreak-style */
/* eslint-disable no-param-reassign */
/* eslint-disable dot-notation */
/* eslint-disable no-console */

const { toLower } = require('./convert');
const { makeGuid } = require('./guid');
const { getCommandTimeout } = require('./timeout');

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
      if (Date.now() - match.timestamp > getCommandTimeout() * 1000) {
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

exports.commands = commands;
exports.createCommand = createCommand;
exports.getCommand = getCommand;
