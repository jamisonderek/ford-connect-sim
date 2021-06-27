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

chai.use(chaiHttp);

describe('Sim Locks tests', () => {
  beforeEach((done) => {
    done();
  });
  describe('POST /sim/locks/:vehicleId', () => {
    describe('with valid vehicleId and query parameters', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/sim/locks/${anyVehicleId}?state=locked`;
      it('it should return HTTP 200 status code', (done) => {
        chai.request(server)
          .post(url)
          .send()
          .end((err, res) => {
            res.should.have.status(200);
            done();
          });
      });
      it('it should return body with status code SUCCESS', (done) => {
        chai.request(server)
          .post(url)
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('SUCCESS');
            done();
          });
      });
    });
    describe('with state LOCKED', () => {
      it('it should set doorsLocked to true', (done) => {
        const anyVehicleId = vehicleData[0].vehicle.vehicleId;
        vehicleData[0].extra.doorsLocked = false;
        chai.request(server)
          .post(`/sim/locks/${anyVehicleId}?state=locked`)
          .send()
          .end(() => {
            vehicleData[0].extra.doorsLocked.should.be.true;
            done();
          });
      });
    });
    describe('with state UNLOCKED', () => {
      it('it should set doorsLocked to false', (done) => {
        const anyVehicleId = vehicleData[0].vehicle.vehicleId;
        vehicleData[0].extra.doorsLocked = true;
        chai.request(server)
          .post(`/sim/locks/${anyVehicleId}?state=unlocked`)
          .send()
          .end(() => {
            vehicleData[0].extra.doorsLocked.should.be.false;
            done();
          });
      });
    });
    describe('with state ERROR', () => {
      it('it should set doorsLocked to undefined', (done) => {
        const anyVehicleId = vehicleData[0].vehicle.vehicleId;
        vehicleData[0].extra.doorsLocked = true;
        chai.request(server)
          .post(`/sim/locks/${anyVehicleId}?state=error`)
          .send()
          .end(() => {
            expect(vehicleData[0].extra.doorsLocked).to.be.undefined;
            done();
          });
      });
    });
    describe('with state parameter missing', () => {
      it('it should have http status code 400', (done) => {
        const anyVehicleId = vehicleData[0].vehicle.vehicleId;
        vehicleData[0].extra.doorsLocked = true;
        chai.request(server)
          .post(`/sim/locks/${anyVehicleId}`)
          .send()
          .end((err, res) => {
            res.should.have.status(400);
            done();
          });
      });
      it('it should have body status with ERROR', (done) => {
        const anyVehicleId = vehicleData[0].vehicle.vehicleId;
        vehicleData[0].extra.doorsLocked = true;
        chai.request(server)
          .post(`/sim/locks/${anyVehicleId}`)
          .send()
          .end((err, res) => {
            expect(res.body.status).to.equal('ERROR');
            done();
          });
      });
      it('it should have msg containing paraneter name (state)', (done) => {
        const anyVehicleId = vehicleData[0].vehicle.vehicleId;
        vehicleData[0].extra.doorsLocked = true;
        chai.request(server)
          .post(`/sim/locks/${anyVehicleId}`)
          .send()
          .end((err, res) => {
            expect(res.body.msg).to.contain('parameter \'state\'');
            done();
          });
      });
      it('it should have msg containing allowed values', (done) => {
        const anyVehicleId = vehicleData[0].vehicle.vehicleId;
        vehicleData[0].extra.doorsLocked = true;
        chai.request(server)
          .post(`/sim/locks/${anyVehicleId}`)
          .send()
          .end((err, res) => {
            expect(res.body.msg).to.contain('locked, unlocked, error');
            done();
          });
      });
    });
  });
});
