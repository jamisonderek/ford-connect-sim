/* eslint-disable linebreak-style */
/* eslint-disable no-param-reassign */
/* eslint-disable dot-notation */
/* eslint-disable no-console */

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

exports.toBoolean = toBoolean;
exports.toDirection = toDirection;
exports.toDoor = toDoor;
exports.toFloat = toFloat;
exports.toLower = toLower;
exports.toRole = toRole;
exports.toState = toState;
