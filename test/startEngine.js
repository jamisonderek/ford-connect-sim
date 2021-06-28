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
const { commands, createCommand } = require('../command');

chai.use(chaiHttp);

describe('Start engine tests', () => {
  const authToken = generateToken().key;
  beforeEach((done) => {
    done();
  });
  describe('POST /api/fordconnect/vehicles/v1/:vehicleId/startEngine', () => {
    describe('with valid vehicleId', () => {
      const anyVehicleId = mockVehicles.ev1.vehicleId;
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/startEngine`;
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
      const url = `/api/fordconnect/vehicles/v1/${badVehicleId}/startEngine`;
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
      const url = `/api/fordconnect/vehicles/v1/${shortVehicleId}/startEngine`;
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
      const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/startEngine`;
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
  describe('GET /api/fordconnect/vehicles/v1/:vehicleId/startEngine/:commandId', () => {
    describe('with valid vehicleId', () => {
      describe('with valid commandId used immediately (pending)', () => {
        const anyVehicleId = mockVehicles.ev1.vehicleId;
        const cmd = createCommand(anyVehicleId);
        commands.startEngine.push(cmd);
        const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/startEngine/${cmd.commandId}`;
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
        commands.startEngine.push(cmd);
        const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/startEngine/${cmd.commandId}`;
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
        commands.startEngine.push(cmd);
        const url = `/api/fordconnect/vehicles/v1/${anyVehicleId}/startEngine/${cmd.commandId}`;
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
