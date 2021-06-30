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

describe('ChargeSchedules tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('GET /api/fordconnect/vehicles/v1/:vehicleId/chargeSchedules', () => {
    describe('with invalid auth token', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/chargeSchedules`;
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
    describe('with EV vehicle at location with schedule', () => {
      const anyEvVehicleId = mockVehicles.ev1.vehicleId;
      const schedules = mockVehicles.ev1_evdata.chargeSchedules;
      const scheduleInfo = schedules[1];
      mockVehicles.ev1_info.vehicleLocation.latitude = scheduleInfo.latitude;
      mockVehicles.ev1_info.vehicleLocation.longitude = scheduleInfo.longitude;
      const url = `/api/fordconnect/vehicles/v1/${anyEvVehicleId}/chargeSchedules`;
      it('VALIDATE: it should return HTTP 200 status code', (done) => {
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
      it('VALIDATE: it should return body status of SUCCESS', (done) => {
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
      it('VALIDATE: it should return body with status code SUCCESS', (done) => {
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
      it('VALIDATE: it should return body with chargeSchedules of array', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(Object.prototype.toString.call(res.body.chargeSchedules)).to.equal('[object Array]');
            done();
          });
      });
      it('VALIDATE: it should return body with chargeSchedules matching expected values', (done) => {
        mockVehicles.ev1_info.vehicleLocation.latitude = scheduleInfo.latitude;
        mockVehicles.ev1_info.vehicleLocation.longitude = scheduleInfo.longitude;
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.chargeSchedules.length).to.equal(scheduleInfo.schedule.length);
            for (let i = 0; i < res.body.chargeSchedules.length; i += 1) {
              expect(res.body.chargeSchedules[i].days).to.equal(scheduleInfo.schedule[i].days);
              // NOTE: desiredChargeLevel should be returned on each item (but our mock has it higher up to reflect dash UI).
              expect(res.body.chargeSchedules[i].desiredChargeLevel).to.equal(scheduleInfo.desiredChargeLevel);
              expect(JSON.stringify(res.body.chargeSchedules[i].chargeWindows)).to.equal(JSON.stringify(scheduleInfo.schedule[i].chargeWindows));
            }
            done();
          });
      });
    });
    describe('with EV vehicle at location with no schedule', () => {
      const anyEvVehicleId = mockVehicles.ev1.vehicleId;
      mockVehicles.ev1_info.vehicleLocation.latitude = '45.100000';
      mockVehicles.ev1_info.vehicleLocation.longitude = '-90.000000';
      const url = `/api/fordconnect/vehicles/v1/${anyEvVehicleId}/chargeSchedules`;
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
      it('it should return body with chargeSchedules of array', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(Object.prototype.toString.call(res.body.chargeSchedules)).to.equal('[object Array]');
            done();
          });
      });
      it('it should return body with chargeSchedules of empty array', (done) => {
        mockVehicles.ev1_info.vehicleLocation.latitude = '45.100000';
        mockVehicles.ev1_info.vehicleLocation.longitude = '-90.000000';
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.chargeSchedules.length).to.equal(0);
            done();
          });
      });
      it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
        const queriedVehicle = anyEvVehicleId;
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.header.vehicleid).to.equal(queriedVehicle);
            done();
          });
      });
    });

    describe('with ICE vehicle', () => {
      const anyIceVehicleId = mockVehicles.ice1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyIceVehicleId}/chargeSchedules`;
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
      it('it should return body with chargeSchedules of array', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(Object.prototype.toString.call(res.body.chargeSchedules)).to.equal('[object Array]');
            done();
          });
      });
      it('it should return body with chargeSchedules of empty array', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.chargeSchedules.length).to.equal(0);
            done();
          });
      });
      it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
        const queriedVehicle = anyIceVehicleId;
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.header.vehicleid).to.equal(queriedVehicle);
            done();
          });
      });
    });
    describe('with unknown vehicle', () => {
      const anyUnknownVehicleId = '01010101010101010101010101010bad';
      const url = `/api/fordconnect/vehicles/v1/${anyUnknownVehicleId}/chargeSchedules`;
      it('it should return HTTP 404 status code', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(404);
            done();
          });
      });
      it('it should return body status of FAILED', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('FAILED');
            done();
          });
      });
      it('it should return body with chargeSchedules of null', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.chargeSchedules).to.equal(null);
            done();
          });
      });
      it('it should return body with error code of 4002', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error.code).to.equal(4002);
            done();
          });
      });
      it('it should return body with error statusCode of NOT_FOUND', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error.statusCode).to.equal('NOT_FOUND');
            done();
          });
      });
      it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
        const queriedVehicle = anyUnknownVehicleId;
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.header.vehicleid).to.equal(queriedVehicle);
            done();
          });
      });
    });
    describe('with bad application-id', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/chargeSchedules`;
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
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/chargeSchedules`;
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
