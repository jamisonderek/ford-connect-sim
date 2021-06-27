/* eslint-disable linebreak-style */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-console */

process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../app');
const mockVehicles = require('../vehicles');
const timestamp = require('../timestamp');

const should = chai.should();
const { expect } = chai;

const { server } = app;
const { generateToken } = app;
const { vehicleData } = app;
const { commands } = app;
const { createCommand } = app;

chai.use(chaiHttp);

describe('Status tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('POST /api/fordconnect/vehicles/v1/:vehicleId/status', () => {
    describe('with valid vehicleId', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/status`;
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
      const url = `/api/fordconnect/vehicles/v1/${badVehicleId}/status`;
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
      const url = `/api/fordconnect/vehicles/v1/${shortVehicleId}/status`;
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
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/status`;
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
  describe('GET /api/fordconnect/vehicles/v1/:vehicleId/statusrefresh/:commandId', () => {
    describe('with valid vehicleId', () => {
      describe('with valid commandId used immediately (pending)', () => {
        const anyVehicleId = mockVehicles.ev1.vehicleId;
        const cmd = createCommand(anyVehicleId);
        commands.status.push(cmd);
        const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/statusrefresh/${cmd.commandId}`;
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
        it('it should return body with status of SUCCESS', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.status).to.equal('SUCCESS');
              done();
            });
        });
        it('it should return body with commandStatus of PENDINGRESPONSE', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.commandStatus).to.equal('PENDINGRESPONSE');
              done();
            });
        });
        it('it should return body with commandId of matching id', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.commandId).to.equal(cmd.commandId);
              done();
            });
        });
        it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
          const queriedVehicle = anyVehicleId;
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.header.vehicleid).to.equal(queriedVehicle);
              done();
            });
        });
      });
      describe('with valid commandId used after 10 minutes (expired)', () => {
        const anyVehicleId = mockVehicles.ev1.vehicleId;
        const cmd = createCommand(anyVehicleId);
        cmd.timestamp -= 10 * 60 * 1000; // 10 minutes later.
        commands.status.push(cmd);
        const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/statusrefresh/${cmd.commandId}`;
        it('it should return HTTP 401 status code', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              res.should.have.status(401);
              done();
            });
        });
        it('it should return body with status of FAILED', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.status).to.equal('FAILED');
              done();
            });
        });
        it('it should return body with commandStatus of FAILED', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.commandStatus).to.equal('FAILED');
              done();
            });
        });
        it('it should return body with error code of 3000', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.error.code).to.equal(3000);
              done();
            });
        });
        it('it should return body with error statusCode of UNAUTHORIZED', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.error.statusCode).to.equal('UNAUTHORIZED');
              done();
            });
        });
        it('it should return body with commandId of matching id', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.commandId).to.equal(cmd.commandId);
              done();
            });
        });
        it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
          const queriedVehicle = anyVehicleId;
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.header.vehicleid).to.equal(queriedVehicle);
              done();
            });
        });
      });
      describe('with valid commandId used after 30 seconds (valid)', () => {
        const anyVehicleId = mockVehicles.ev1.vehicleId;
        const cmd = createCommand(anyVehicleId);
        cmd.timestamp -= 30 * 1000; // 30 seconds later.
        commands.status.push(cmd);
        const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/statusrefresh/${cmd.commandId}`;
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
        it('it should return body with status of SUCCESS', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.status).to.equal('SUCCESS');
              done();
            });
        });
        it('it should return body with commandStatus of COMPLETED', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.commandStatus).to.equal('COMPLETED');
              done();
            });
        });
        it('it should return body with commandId of matching id', (done) => {
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.commandId).to.equal(cmd.commandId);
              done();
            });
        });
        it('it should return vehicleStatus with lockStatus value of LOCKED when locked', (done) => {
          const vehicle = vehicleData.filter((v) => v.vehicle.vehicleId === anyVehicleId)[0];
          vehicle.extra.doorsLocked = true;
          vehicle.extra.doorsLockedTimestamp = timestamp.now();
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.vehicleStatus.lockStatus.value).to.equal('LOCKED');
              done();
            });
        });
        it('it should return vehicleStatus with lockStatus value of UNLOCKED when not locked', (done) => {
          const vehicle = vehicleData.filter((v) => v.vehicle.vehicleId === anyVehicleId)[0];
          vehicle.extra.doorsLocked = false;
          vehicle.extra.doorsLockedTimestamp = timestamp.now();
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.vehicleStatus.lockStatus.value).to.equal('UNLOCKED');
              done();
            });
        });
        it('it should return vehicleStatus with lockStatus value of ERROR when undefined state', (done) => {
          const vehicle = vehicleData.filter((v) => v.vehicle.vehicleId === anyVehicleId)[0];
          vehicle.extra.doorsLocked = undefined;
          vehicle.extra.doorsLockedTimestamp = timestamp.now();
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.vehicleStatus.lockStatus.value).to.equal('ERROR');
              done();
            });
        });
        it('it should return vehicleStatus with lockStatus timestamp of when locked', (done) => {
          const ts = timestamp.now();
          const vehicle = vehicleData.filter((v) => v.vehicle.vehicleId === anyVehicleId)[0];
          vehicle.extra.doorsLocked = true;
          vehicle.extra.doorsLockedTimestamp = ts;
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.vehicleStatus.lockStatus.timestamp).to.equal(ts);
              done();
            });
        });
        it('it should return vehicleStatus with alarm value of ACTIVE when alarm is going off', (done) => {
          const vehicle = vehicleData.filter((v) => v.vehicle.vehicleId === anyVehicleId)[0];
          vehicle.extra.alarmEnabled = true;
          vehicle.extra.alarmTriggered = true;
          vehicle.extra.alarmTimestamp = timestamp.now();
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.vehicleStatus.alarm.value).to.equal('ACTIVE');
              done();
            });
        });
        it('it should return vehicleStatus with alarm value of SET when alarm is enabled', (done) => {
          const vehicle = vehicleData.filter((v) => v.vehicle.vehicleId === anyVehicleId)[0];
          vehicle.extra.alarmEnabled = true;
          vehicle.extra.alarmTriggered = false;
          vehicle.extra.alarmTimestamp = timestamp.now();
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.vehicleStatus.alarm.value).to.equal('SET');
              done();
            });
        });
        it('it should return vehicleStatus with alarm value of NOTSET when alarm is not enabled', (done) => {
          const vehicle = vehicleData.filter((v) => v.vehicle.vehicleId === anyVehicleId)[0];
          vehicle.extra.alarmEnabled = false;
          vehicle.extra.alarmTriggered = false;
          vehicle.extra.alarmTimestamp = timestamp.now();
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.vehicleStatus.alarm.value).to.equal('NOTSET');
              done();
            });
        });
        it('it should return vehicleStatus with alarm value of ERROR when alarm is undefined', (done) => {
          const vehicle = vehicleData.filter((v) => v.vehicle.vehicleId === anyVehicleId)[0];
          vehicle.extra.alarmEnabled = undefined;
          vehicle.extra.alarmTriggered = undefined;
          vehicle.extra.alarmTimestamp = timestamp.now();
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.vehicleStatus.alarm.value).to.equal('ERROR');
              done();
            });
        });
        it('it should return vehicleStatus with alarm timestamp of when alarm enabled', (done) => {
          const ts = timestamp.now();
          const vehicle = vehicleData.filter((v) => v.vehicle.vehicleId === anyVehicleId)[0];
          vehicle.extra.alarmEnabled = true;
          vehicle.extra.alarmTriggered = false;
          vehicle.extra.alarmTimestamp = ts;
          chai.request(server)
            .get(url)
            .auth(authToken, { type: 'bearer' })
            .send()
            .end((err, res) => {
              expect(res.body.vehicleStatus.alarm.timestamp).to.equal(ts);
              done();
            });
        });
        it('it should return header with Vehicleid containing the vehicleid requested', (done) => {
          const queriedVehicle = anyVehicleId;
          chai.request(server)
            .get(url)
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
});
