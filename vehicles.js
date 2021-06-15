/* eslint-disable linebreak-style */

const timestamp = require('./timestamp');

// ICE stands for Internal Combustion Engine.
// EV stands for Electric Vehicle.

exports.ice1 = {
  vehicleId: '12341234123412341234123412341234',
  make: 'F',
  modelName: 'Edge',
  modelYear: '2020',
  color: 'OXFORD WHITE SOLID C/C',
  nickName: 'ICE test car #1',
  modemEnabled: true,
  vehicleAuthorizationIndicator: 1,
  serviceCompatible: true,
};

// timeStamp and timestamp.
exports.ice1_info = {
  engineType: 'ICE',
  lastUpdated: timestamp.now(),
  vehicleDetails: {
    fuelLevel: {
      value: -5.0,
      distanceToEmpty: 0.0,
      timestamp: timestamp.now(),
    },
    batteryChargeLevel: {
      value: null,
      distanceToEmpty: 0.0,
      timestamp: null,
    },
    mileage: 124.3,
    odometer: 200.0,
  },
  vehicleStatus: {
    tirePressureWarning: false,
    deepSleepInProgress: false,
    firmwareUpgradeInProgress: false,
    remoteStartStatus: {
      status: 'ENGINE_RUNNING',
      duration: 0, // REVIEW: Is this because of a bug?
      timeStamp: timestamp.now(),
    },
    chargingStatus: {
      value: 'EvseNotDetected',
      timeStamp: timestamp.now(),
      chargeStartTime: '06-08-2021 11:58:00', // REVIEW: I would have expected null for an ICE?
      chargeEndTime: '06-08-2021 12:29:00', // REVIEW: I would have expected null for an ICE?
    },
    plugStatus: {
      value: false,
      timeStamp: timestamp.now(),
    },
    ignitionStatus: {
      value: 'ON',
      timeStamp: timestamp.now(),
    },
    doorStatus: [
      {
        vehicleDoor: 'UNSPECIFIED_FRONT',
        value: 'CLOSED',
        vehicleOccupantRole: 'DRIVER',
        timeStamp: timestamp.now(),
      },
      {
        vehicleDoor: 'UNSPECIFIED_FRONT',
        value: 'CLOSED',
        vehicleOccupantRole: 'PASSENGER',
        timeStamp: timestamp.now(),
      },
      {
        vehicleDoor: 'HOOD_DOOR',
        value: 'CLOSED',
        vehicleOccupantRole: 'NOT_APPLICABLE',
        timeStamp: timestamp.now(),
      },
      {
        vehicleDoor: 'REAR_LEFT',
        value: 'CLOSED',
        vehicleOccupantRole: 'PASSENGER',
        timeStamp: timestamp.now(),
      },
      {
        vehicleDoor: 'REAR_RIGHT',
        value: 'CLOSED',
        vehicleOccupantRole: 'PASSENGER',
        timeStamp: timestamp.now(),
      },
      {
        vehicleDoor: 'TAILGATE',
        value: 'CLOSED',
        vehicleOccupantRole: 'PASSENGER',
        timeStamp: timestamp.now(),
      },
      {
        vehicleDoor: 'INNER_TAILGATE',
        value: 'CLOSED',
        vehicleOccupantRole: 'PASSENGER',
        timeStamp: timestamp.now(),
      },
    ],
    vehicleLocation: {
      longitude: '-83.205202',
      latitude: '42.300291',
      speed: 0.0,
      direction: 'NorthWest',
      timeStamp: timestamp.now(),
    },
  },
};

exports.ice2 = {
  vehicleId: '52341234123412341234123412341235',
  make: 'F',
  modelName: 'E-450',
  modelYear: '2018',
  color: 'OXFORD WHITE SOLID C/C',
  nickName: 'ICE test car #2 (not compatible)',
  modemEnabled: false,
  vehicleAuthorizationIndicator: 0,
  serviceCompatible: false,
};
