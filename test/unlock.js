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
const { generateToken } = app;

chai.use(chaiHttp);

describe('Unlock tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('POST /api/fordconnect/vehicles/v1/:vehicleId/unlock', () => {
    describe('with valid vehicleId', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/unlock`;
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
  });
});
