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
const { generateToken } = require('../token');

chai.use(chaiHttp);

describe('Wake tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('POST /api/fordconnect/vehicles/v1/:vehicleId/wake', () => {
    describe('with valid vehicleId', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/wake`;
      it('it should return HTTP 202 status code', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(202);
            done();
          });
      });
      it('it should return body with status code SUCCESS', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('SUCCESS');
            done();
          });
      });
      it('it should return body with commandStatus of COMPLETED', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.commandStatus).to.equal('COMPLETED');
            done();
          });
      });
      it('it should return body with commandId matching a guid format', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.commandId).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
            done();
          });
      });
      it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
        const queriedVehicle = anyVehicleId;
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.header.vehicleid).to.equal(queriedVehicle);
            done();
          });
      });
    });
    describe('with invalid vehicleId', () => {
      const badVehicleId = 'BADBADBADBADBADBADBADBADBADBADBA';
      const url = `/api/fordconnect/vehicles/v1/${badVehicleId}/wake`;
      it('it should return HTTP 404 status code', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(404);
            done();
          });
      });
      it('it should return body with error code 4002', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error.code).to.equal(4002);
            done();
          });
      });
      it('it should return body with error statusCode NOT_FOUND', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error.statusCode).to.equal('NOT_FOUND');
            done();
          });
      });
      it('it should return body with status of FAILED', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('FAILED');
            done();
          });
      });
      it('it should return body with commandStatus of EMPTY', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.commandStatus).to.equal('EMPTY');
            done();
          });
      });
    });
    describe('with wrong length vehicleId', () => {
      const shortVehicleId = 'TOOSHORTID';
      const url = `/api/fordconnect/vehicles/v1/${shortVehicleId}/wake`;
      it('it should return HTTP 400 status code', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(400);
            done();
          });
      });
      it('it should return errorCode 400', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.errorCode).to.equal('400');
            done();
          });
      });
      it('it should return errorMessage containing "Invalid vehicleId"', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.errorMessage).to.contain('Invalid vehicleId');
            done();
          });
      });
      it('it should return errorMessage containing "size must be between 32 and 32"', (done) => {
        chai.request(server)
          .post(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.errorMessage).to.contain('size must be between 32 and 32');
            done();
          });
      });
    });
    describe('with invalid auth token', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/wake`;
      const invalidAuthToken = 'INVALID TOKEN';
      it('it should return HTTP 401 status code', (done) => {
        chai.request(server)
          .post(url)
          .auth(invalidAuthToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(401);
            done();
          });
      });
    });
  });
});
