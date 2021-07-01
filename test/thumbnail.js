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
const { generateToken, applicationId } = require('../token');

chai.use(chaiHttp);

describe('Thumbnail image tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('GET /api/fordconnect/vehicles/v1/:vehicleId/images/thumbnail', () => {
    describe('with invalid auth token', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/images/thumbnail?make=Ford&model=&year=2019`;
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
    describe('with valid auth token and params', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/images/thumbnail?make=Ford&model=&year=2019`;
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
      it('it should return data of image', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            const response = JSON.parse(JSON.stringify(res.body));
            expect(response.type).to.equal('Buffer');
            expect(response.data.length).to.be.greaterThanOrEqual(1000);
            done();
          });
      });
      it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
        const queriedVehicle = anyVehicleId;
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
    describe('with bad make value', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/images/thumbnail?make=Unknown&model=&year=2019`;
      it('NOTE FORDCONNECT SERVER GIVES (500): it should return HTTP 400 status code', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(400); // NOTE: Server gives 500, but simulator gives 400.
            done();
          });
      });
    });
    describe('with bad make year', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/images/thumbnail?make=Unknown&model=&year=2002`;
      it('NOTE FORDCONNECT SERVER GIVES (500): it should return HTTP 400 status code', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            res.should.have.status(400); // NOTE: Server gives 500, but simulator gives 400.
            done();
          });
      });
    });
    describe('with missing make', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/images/thumbnail?model=&year=2019`;
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
      it('it should return body statusCode of 404', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.statusCode).to.equal(404);
            done();
          });
      });
      it('it should return body message of "Resource not found"', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.message).to.equal('Resource not found');
            done();
          });
      });
    });
    describe('with missing model', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/images/thumbnail?make=Ford&year=2019`;
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
      it('it should return body statusCode of 404', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.statusCode).to.equal(404);
            done();
          });
      });
      it('it should return body message of "Resource not found"', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.message).to.equal('Resource not found');
            done();
          });
      });
    });
    describe('with missing year', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/images/thumbnail?make=Ford&model=`;
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
      it('it should return body statusCode of 404', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.statusCode).to.equal(404);
            done();
          });
      });
      it('it should return body message of "Resource not found"', (done) => {
        chai.request(server)
          .get(url)
          .set('Application-Id', applicationId)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.message).to.equal('Resource not found');
            done();
          });
      });
    });
    describe('with bad application-id', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/images/thumbnail?make=Ford&model=&year=2019`;
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
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/images/thumbnail?make=Ford&model=&year=2019`;
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
