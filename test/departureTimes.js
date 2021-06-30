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
const { today } = app;
const { generateToken, applicationId } = require('../token');

chai.use(chaiHttp);

describe('DepartureTimes tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('GET /api/fordconnect/vehicles/v1/:vehicleId/departureTimes', () => {
    describe('with invalid auth token', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/departureTimes`;
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
    describe('with EV vehicle departing soon', () => {
      const anyEvVehicleId = mockVehicles.ev1.vehicleId;
      const times = mockVehicles.ev1_evdata.departureTimes;
      const departure = times[1];
      today.dayOfWeek = departure.dayOfWeek;
      const hour = parseInt(departure.time.split(':')[0], 10);
      today.hour = hour;
      const minutes = parseInt(departure.time.split(':')[1], 10);
      today.minutes = 30;
      if (today.hour > 0) {
        today.hour -= 1;
      }
      // TODO: Set TODAY.
      const url = `/api/fordconnect/vehicles/v1/${anyEvVehicleId}/departureTimes`;
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
      it('VALIDATE: it should return body with departureTimes having dayOfWeek', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(Object.prototype.toString.call(res.body.departureTimes.dayOfWeek)).to.match(/(MON|TUES|WEDNES|THURS|FRI|SATUR|SUN)DAY|/);
            expect(res.body.departureTimes.dayOfWeek).to.equal(departure.dayOfWeek);
            done();
          });
      });
      it('VALIDATE: it should return body with departureTimes having enabled', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.departureTimes.enabled).to.equal(true);
            done();
          });
      });
      it('VALIDATE: it should return body with departureTimes having hour', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            console.log(JSON.stringify(res.body));
            expect(today.hour).to.be.greaterThan(0, 'The test data should have departure after 2am');
            expect(res.body.departureTimes.hour).to.be.greaterThanOrEqual(0);
            expect(res.body.departureTimes.hour).to.be.lessThanOrEqual(23);
            expect(res.body.departureTimes.hour).to.equal(hour);
            done();
          });
      });
      it('VALIDATE: it should return body with departureTimes having minutes', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.departureTimes.minutes).to.be.greaterThanOrEqual(0);
            expect(res.body.departureTimes.minutes).to.be.lessThanOrEqual(59);
            expect(res.body.departureTimes.minutes).to.equal(minutes);
            done();
          });
      });
      it('VALIDATE: it should return body with departureTimes having preConditioningSetting', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.departureTimes.preConditioningSetting).to.match(/OFF|COOL|MEDIUM|WARM/);
            expect(res.body.departureTimes.preConditioningSetting).to.equal(departure.preConditioningSetting);
            done();
          });
      });
    });
    describe('with ICE vehicle', () => {
      const anyIceVehicleId = mockVehicles.ice1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyIceVehicleId}/departureTimes`;
      it('it should return HTTP 406 status code', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(406);
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
      it('it should return body error code of 4006', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error.code).to.equal(4006);
            done();
          });
      });
      it('it should return body error statusCode of NOT_ACCEPTABLE', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error.statusCode).to.equal('NOT_ACCEPTABLE');
            done();
          });
      });
      it('it should return body with departureTimes of null', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.departureTimes).to.equal(null);
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
      const url = `/api/fordconnect/vehicles/v1/${anyUnknownVehicleId}/departureTimes`;
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
      it('it should return body with departureTimes of null', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.departureTimes).to.equal(null);
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
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/departureTimes`;
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
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/departureTimes`;
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
