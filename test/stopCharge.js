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

describe('StopCharge vehicles tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('GET /api/fordconnect/vehicles/v1/:vehicleId/stopCharge', () => {
    describe('with invalid auth token', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/stopCharge`;
      const invalidAuthToken = 'INVALID TOKEN';
      it('it should return HTTP 401 status code', (done) => {
        chai.request(server)
          .post(url)
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
          .post(url)
          .set('Application-Id', applicationId)
          .auth(invalidAuthToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error).to.equal('invalid_token');
            done();
          });
      });
    });
    describe('with EV vehicle', () => {
      const anyEvVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyEvVehicleId}/stopCharge`;
      it('VALIDATE: it should return HTTP 202 status code', (done) => {
        chai.request(server)
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(202);
            done();
          });
      });
      it('VALIDATE: it should return body status of SUCCESS', (done) => {
        chai.request(server)
          .post(url)
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
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('SUCCESS');
            done();
          });
      });
      it('VALIDATE: it should return body with commandStatus of COMPLETED', (done) => {
        chai.request(server)
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.commandStatus).to.equal('COMPLETED');
            done();
          });
      });
      it('VALIDATE: it should return body with commandId matching a guid format', (done) => {
        chai.request(server)
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.commandId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
            done();
          });
      });
      it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
        const queriedVehicle = anyEvVehicleId;
        chai.request(server)
          .post(url)
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
      const url = `/api/fordconnect/vehicles/v1/${anyIceVehicleId}/stopCharge`;
      it('it should return HTTP 406 status code', (done) => {
        chai.request(server)
          .post(url)
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
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('FAILED');
            done();
          });
      });
      it('it should return body with commandStatus of FAILED', (done) => {
        chai.request(server)
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.commandStatus).to.equal('FAILED');
            done();
          });
      });
      it('it should return body with error code of 4006', (done) => {
        chai.request(server)
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error.code).to.equal(4006);
            done();
          });
      });
      it('it should return body with error statusCode of NOT_ACCEPTABLE', (done) => {
        chai.request(server)
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error.statusCode).to.equal('NOT_ACCEPTABLE');
            done();
          });
      });
      it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
        const queriedVehicle = anyIceVehicleId;
        chai.request(server)
          .post(url)
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
      const url = `/api/fordconnect/vehicles/v1/${anyUnknownVehicleId}/stopCharge`;
      it('it should return HTTP 404 status code', (done) => {
        chai.request(server)
          .post(url)
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
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('FAILED');
            done();
          });
      });
      it('it should return body with commandStatus of FAILED', (done) => {
        chai.request(server)
          .post(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.commandStatus).to.equal('FAILED');
            done();
          });
      });
      it('it should return body with error code of 4002', (done) => {
        chai.request(server)
          .post(url)
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
          .post(url)
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
          .post(url)
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
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/stopCharge`;
      it('it should return HTTP 401 status code', (done) => {
        chai.request(server)
          .post(url)
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
          .post(url)
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
          .post(url)
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
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/stopCharge`;
      const invalidAppId = 'INVALID-APP-ID';
      it('it should return HTTP 401 status code', (done) => {
        chai.request(server)
          .post(url)
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
          .post(url)
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
          .post(url)
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
