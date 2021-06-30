/* eslint-disable linebreak-style */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-console */

process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../app');
const mockVehicles = require('../vehicles');

const should = chai.should();
const { expect } = chai;

const { server } = app;
const { vehicleData } = app;
const { generateToken, applicationId } = require('../token');

chai.use(chaiHttp);

describe('Get vehicle info tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('GET /api/fordconnect/vehicles/v1/:vehicleId', () => {
    describe('with invalid auth token', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}`;
      const invalidAuthToken = 'INVALID TOKEN';
      it('it should return HTTP 401 status code', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(invalidAuthToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(401);
            done();
          });
      });
      it('it should return body error of invalid_token', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(invalidAuthToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error).to.equal('invalid_token');
            done();
          });
      });
    });
    describe('with EV', () => {
      const anyEvVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyEvVehicleId}`;
      it('it should return HTTP 200 status code', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(200);
            done();
          });
      });
      it('it should return body status of SUCCESS', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('SUCCESS');
            done();
          });
      });
      it('it should return vehicle core data matching the mock', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleId).to.equal(mockVehicles.ev1.vehicleId);
            expect(res.body.vehicle.make).to.equal(mockVehicles.ev1.make);
            expect(res.body.vehicle.modelName).to.equal(mockVehicles.ev1.modelName);
            expect(res.body.vehicle.modelYear).to.equal(mockVehicles.ev1.modelYear);
            expect(res.body.vehicle.color).to.equal(mockVehicles.ev1.color);
            expect(res.body.vehicle.nickName).to.equal(mockVehicles.ev1.nickName);
            expect(res.body.vehicle.modemEnabled).to.equal(mockVehicles.ev1.modemEnabled);
            expect(res.body.vehicle.vehicleAuthorizationIndicator).to.equal(mockVehicles.ev1.vehicleAuthorizationIndicator);
            expect(res.body.vehicle.serviceCompatible).to.equal(mockVehicles.ev1.serviceCompatible);
            done();
          });
      });
      it('it should return vehicle lastupdated matching the mock', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.lastUpdated).to.equal(mockVehicles.ev1_info.lastUpdated);
            done();
          });
      });
      it('it should return vehicle engineType matching the mock', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.engineType).to.equal(mockVehicles.ev1_info.engineType);
            done();
          });
      });
      it('it should return fuelLevel matching the mock', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleDetails.fuelLevel.value).to.equal(mockVehicles.ev1_info.vehicleDetails.fuelLevel.value);
            expect(res.body.vehicle.vehicleDetails.fuelLevel.distanceToEmpty).to.equal(mockVehicles.ev1_info.vehicleDetails.fuelLevel.distanceToEmpty);
            expect(res.body.vehicle.vehicleDetails.fuelLevel.timestamp).to.equal(mockVehicles.ev1_info.vehicleDetails.fuelLevel.timestamp);
            done();
          });
      });
      it('it should return batteryChargeLevel matching the mock', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleDetails.batteryChargeLevel.value).to.equal(mockVehicles.ev1_info.vehicleDetails.batteryChargeLevel.value);
            expect(res.body.vehicle.vehicleDetails.batteryChargeLevel.distanceToEmpty).to.equal(mockVehicles.ev1_info.vehicleDetails.batteryChargeLevel.distanceToEmpty);
            expect(res.body.vehicle.vehicleDetails.batteryChargeLevel.timestamp).to.equal(mockVehicles.ev1_info.vehicleDetails.batteryChargeLevel.timestamp);
            done();
          });
      });
      it('it should return mileage and odometer matching the mock', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleDetails.mileage).to.equal(mockVehicles.ev1_info.vehicleDetails.mileage);
            expect(res.body.vehicle.vehicleDetails.odometer).to.equal(mockVehicles.ev1_info.vehicleDetails.odometer);
            const mi = res.body.vehicle.vehicleDetails.mileage;
            const km = res.body.vehicle.vehicleDetails.odometer;
            const diff = (mi * 1.609) - km;
            expect(diff).to.be.lessThan(1.0, `mileage (${mi} miles) and odometer (${km} km) should be equilivant values.`);
            done();
          });
      });
      it('it should return location matching the mock', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleLocation.longitude).to.equal(mockVehicles.ev1_info.vehicleLocation.longitude);
            expect(res.body.vehicle.vehicleLocation.latitude).to.equal(mockVehicles.ev1_info.vehicleLocation.latitude);
            expect(res.body.vehicle.vehicleLocation.speed).to.equal(mockVehicles.ev1_info.vehicleLocation.speed);
            expect(res.body.vehicle.vehicleLocation.direction).to.equal(mockVehicles.ev1_info.vehicleLocation.direction);
            expect(res.body.vehicle.vehicleLocation.direction).to.match(/North|South|East|West|NorthWest|NorthEast|SouthWest|SouthEast/);
            expect(res.body.vehicle.vehicleLocation.timeStamp).to.equal(mockVehicles.ev1_info.vehicleLocation.timeStamp);
            done();
          });
      });
      it('it should return location direction with proper casing', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleLocation.direction).to.match(/North|South|East|West|NorthWest|NorthEast|SouthWest|SouthEast/);
            done();
          });
      });
      it('it should return tirePressure', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleStatus.tirePressureWarning).to.equal(mockVehicles.ev1_info.vehicleStatus.tirePressureWarning);
            done();
          });
      });
      it('it should return deepSleepInProgress', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleStatus.deepSleepInProgress).to.equal(mockVehicles.ev1_info.vehicleStatus.deepSleepInProgress);
            done();
          });
      });
      it('it should return firmwareUpgradeInProgress', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleStatus.firmwareUpgradeInProgress).to.equal(mockVehicles.ev1_info.vehicleStatus.firmwareUpgradeInProgress);
            done();
          });
      });
      it('it should return remoteStartStatus', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleStatus.remoteStartStatus.status).to.equal(mockVehicles.ev1_info.vehicleStatus.remoteStartStatus.status);
            expect(res.body.vehicle.vehicleStatus.remoteStartStatus.duration).to.equal(mockVehicles.ev1_info.vehicleStatus.remoteStartStatus.duration);
            expect(res.body.vehicle.vehicleStatus.remoteStartStatus.timeStamp).to.equal(mockVehicles.ev1_info.vehicleStatus.remoteStartStatus.timeStamp);
            done();
          });
      });
      it('it should return chargingStatus', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleStatus.chargingStatus.value).to.equal(mockVehicles.ev1_info.vehicleStatus.chargingStatus.value);
            expect(res.body.vehicle.vehicleStatus.chargingStatus.timeStamp).to.equal(mockVehicles.ev1_info.vehicleStatus.chargingStatus.timeStamp);
            expect(res.body.vehicle.vehicleStatus.chargingStatus.chargeStartTime).to.equal(mockVehicles.ev1_info.vehicleStatus.chargingStatus.chargeStartTime);
            expect(res.body.vehicle.vehicleStatus.chargingStatus.chargeEndTime).to.equal(mockVehicles.ev1_info.vehicleStatus.chargingStatus.chargeEndTime);
            done();
          });
      });
      it('it should return plugStatus', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleStatus.plugStatus.value).to.equal(mockVehicles.ev1_info.vehicleStatus.plugStatus.value);
            expect(res.body.vehicle.vehicleStatus.plugStatus.timeStamp).to.equal(mockVehicles.ev1_info.vehicleStatus.plugStatus.timeStamp);
            done();
          });
      });
      it('it should return ignitionStatus', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleStatus.ignitionStatus.value).to.equal(mockVehicles.ev1_info.vehicleStatus.ignitionStatus.value);
            expect(res.body.vehicle.vehicleStatus.ignitionStatus.timeStamp).to.equal(mockVehicles.ev1_info.vehicleStatus.ignitionStatus.timeStamp);
            done();
          });
      });
      it('it should return doorStatus', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicle.vehicleStatus.doorStatus.length).to.equal(mockVehicles.ev1_info.vehicleStatus.doorStatus.length);
            for (let i = 0; i < res.body.vehicle.vehicleStatus.doorStatus.length; i += 1) {
              const actualDoor = res.body.vehicle.vehicleStatus.doorStatus[i];
              const expectDoor = mockVehicles.ev1_info.vehicleStatus.doorStatus[i];
              // TODO: We don't really care about order, so we should fix test to not break if items are reordered.
              expect(actualDoor.vehicleDoor).to.equal(expectDoor.vehicleDoor);
              expect(actualDoor.value).to.equal(expectDoor.value);
              expect(actualDoor.vehicleOccupantRole).to.equal(expectDoor.vehicleOccupantRole);
              expect(actualDoor.timeStamp).to.equal(expectDoor.timeStamp);
            }
            done();
          });
      });
    });
    describe('with bad application-id', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}`;
      it('it should return HTTP 401 status code', (done) => {
        chai.request(server)
          .get(url)
          //.set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(401);
            done();
          });
      });
      it('it should return body statusCode of 401', (done) => {
        chai.request(server)
          .get(url)
          //.set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.statusCode).to.equal(401);
            done();
          });
      });
      it('it should return body message of "missing subscription key"', (done) => {
        chai.request(server)
          .get(url)
          //.set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.message).to.contain('missing subscription key');
            done();
          });
      });
    });
    describe('with missing application-id', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}`;
      const invalidAppId = 'INVALID-APP-ID';
      it('it should return HTTP 401 status code', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', invalidAppId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(401);
            done();
          });
      });
      it('it should return body statusCode of 401', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', invalidAppId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.statusCode).to.equal(401);
            done();
          });
      });
      it('it should return body message of "invalid subscription key"', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', invalidAppId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.message).to.contain('invalid subscription key');
            done();
          });
      });
    });
  });
});
