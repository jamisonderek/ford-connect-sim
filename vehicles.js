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

exports.ev1 = {
  vehicleId: '22221111111111151111111111112222',
  make: 'F',
  modelName: 'Mustang Mach-E GT',
  modelYear: '2021',
  color: 'Grabber Blue Metallic',
  nickName: 'EV test car #1',
  modemEnabled: true,
  vehicleAuthorizationIndicator: 1,
  serviceCompatible: true,
};

exports.ev1_info = {
  engineType: 'EV',
  lastUpdated: timestamp.now(),
  vehicleDetails: {
    fuelLevel: {
      value: null,
      distanceToEmpty: 0.0,
      timestamp: null,
    },
    batteryChargeLevel: {
      value: 80, // 0 to 100% charged
      distanceToEmpty: 304.0, // km (range of Mach-E GT package was about 235 mi/380 km)
      timestamp: timestamp.now(),
    },
    mileage: 310.7,
    odometer: 500.0,
  },
  vehicleStatus: {
    tirePressureWarning: false,
    deepSleepInProgress: false,
    firmwareUpgradeInProgress: false,
    remoteStartStatus: {
      status: 'ENGINE_STOPPED',
      duration: 0, // REVIEW: Is this how long the engine has been off?
      timeStamp: timestamp.now(),
    },
    chargingStatus: {
      value: 'Ready',
      timeStamp: timestamp.now(),
      chargeStartTime: '06-08-2021 11:58:00',
      chargeEndTime: '06-08-2021 12:29:00',
    },
    plugStatus: {
      value: true,
      timeStamp: timestamp.now(),
    },
    ignitionStatus: {
      value: 'OFF',
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
        vehicleOccupantRole: 'NOT_APPLICABLE', // REVIEW: This may not be the correct value.
        timeStamp: timestamp.now(),
      },
    ],
    vehicleLocation: {
      longitude: '-95.905261',
      latitude: '36.113439',
      speed: 0.0,
      direction: 'East',
      timeStamp: timestamp.now(),
    },
  },
};

exports.ev1_evdata = {
  departureTimes: [
    {
      dayOfWeek: 'FRIDAY', // The Ford UX allows two entries per day.
      time: '17:00', // NOTE: API response will be two properties (hour, minutes).
      preConditioningSetting: 'MEDIUM', // OFF, COOL, MEDIUM, WARM.
    },
    {
      dayOfWeek: 'TUESDAY',
      time: '8:00',
      preConditioningSetting: 'WARM',
    },
  ],
  chargeSchedules: [
    {
      name: 'Fowler Ford',
      latitude: '36.113430',
      longitude: '-95.905260',
      desiredChargeLevel: 80,
      schedule: [
        {
          days: 'WEEKDAY',
          chargeWindows: [
            {
              startTime: '23:00',
              endTime: '07:00',
            },
          ],
        },
        {
          days: 'WEEKEND',
          chargeWindows: [
            {
              startTime: '0:00',
              endTime: '0:00',
            },
          ],
        },
      ],
    },
    {
      name: '3905 S Memorial Dr',
      latitude: '36.105539',
      longitude: '-95.885703',
      desiredChargeLevel: 80,
      schedule: [
        {
          days: 'WEEKDAY',
          chargeWindows: [
            {
              startTime: '23:00',
              endTime: '07:00',
            },
          ],
        },
        {
          days: 'WEEKEND',
          chargeWindows: [
            {
              startTime: '0:00',
              endTime: '0:00',
            },
          ],
        },
      ],
    },
    {
      name: '2010 N Memorial Dr',
      latitude: '36.183432',
      longitude: '-95.887811',
      desiredChargeLevel: 70,
      schedule: [
        {
          days: 'WEEKDAY',
          chargeWindows: [
            {
              startTime: '23:00',
              endTime: '07:00',
            },
          ],
        },
        {
          days: 'WEEKEND',
          chargeWindows: [
            {
              startTime: '0:00',
              endTime: '0:00',
            },
          ],
        },
      ],
    },
  ],
};
