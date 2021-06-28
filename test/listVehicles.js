/* eslint-disable linebreak-style */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-console */

process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../app');

const should = chai.should();
const { expect } = chai;

const { server } = app;
const { vehicleData } = app;
const { generateToken } = require('../token');

chai.use(chaiHttp);

describe('Unlock tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('GET /api/fordconnect/vehicles/v1', () => {
    describe('with invalid auth token', () => {
      const url = '/api/fordconnect/vehicles/v1';
      const invalidAuthToken = 'INVALID TOKEN';
      it('it should return HTTP 401 status code', (done) => {
        chai.request(server)
          .get(url)
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
          .auth(invalidAuthToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.error).to.equal('invalid_token');
            done();
          });
      });
    });
    describe('with valid auth token', () => {
      const url = '/api/fordconnect/vehicles/v1';
      it('it should return HTTP 200 status code', (done) => {
        chai.request(server)
          .get(url)
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
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('SUCCESS');
            done();
          });
      });
      it('it should return body vehicles as an array', (done) => {
        chai.request(server)
          .get(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(Object.prototype.toString.call(res.body.vehicles)).to.equal('[object Array]');
            done();
          });
      });
      it('it should return body vehicles with length matching mocked vehicles', (done) => {
        chai.request(server)
          .get(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            expect(res.body.vehicles.length).to.equal(vehicleData.length);
            done();
          });
      });
      it('it should return body vehicles matching the mocks', (done) => {
        chai.request(server)
          .get(url)
          .auth(authToken, { type: 'bearer' })
          .send()
          .end((err, res) => {
            const vids = [];
            for (let i = 0; i < res.body.vehicles.length; i += 1) {
              const actual = res.body.vehicles[i];
              const expected = vehicleData.filter((v) => v
                .vehicle.vehicleId === actual.vehicleId)[0].vehicle;
              // This should not be a vehicleId we already have processed.
              expect(vids.filter((v) => v === actual.vehicleId).length).to.equal(0, 'vehicleId not unique?');
              vids.push(actual.vehicleId);
              // Compare all of the attributes against the mock data.
              expect(actual.vehicleId).to.equal(expected.vehicleId);
              expect(actual.make).to.equal(expected.make);
              expect(actual.modelName).to.equal(expected.modelName);
              expect(actual.modelYear).to.equal(expected.modelYear);
              expect(actual.color).to.equal(expected.color);
              expect(actual.nickName).to.equal(expected.nickName);
              expect(actual.modemEnabled).to.equal(expected.modemEnabled);
              expect(actual.vehicleAuthorizationIndicator).to.equal(expected.vehicleAuthorizationIndicator);
              expect(actual.serviceCompatible).to.equal(expected.serviceCompatible);
            }
            done();
          });
      });
    });
  });
});
