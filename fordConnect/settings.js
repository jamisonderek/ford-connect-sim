/* eslint-disable linebreak-style */
/* eslint-disable no-console */

/**
 * FORDSIM_NGROK environment variable is the domain name of your ngrok server
 * hosting the simulator.  If it is not set, then the FordConnect API server
 * (*.ford.com) will be used instead.
 */
const ngrok = process.env.FORDSIM_NGROK;

/**
 * This is the hostname that is used for making the oauth token calls.
 */
exports.oauthhostname = ngrok !== undefined ? ngrok : 'dah2vb2cprod.b2clogin.com';

/**
 * This is the hostname that is used for making general FordConnect calls.
 */
exports.hostname = ngrok !== undefined ? ngrok : 'api.mps.ford.com';

/**
 * This is the port used for all of the HTTPS calls.  It is set to 443.
 */
exports.port = 443;

/**
 * This is the Application-Id header value.
 */
exports.applicationId = 'afdc085b-377a-4351-b23e-5e1d35fb3700';

/**
 * This is the client_id parameter used in oauth calls.
 */
exports.clientId = '30990062-9618-40e1-a27b-7c6bcb23658a';

/**
 * FORD_CLIENTSECRET environment variable is the secret value for connecting
 * to the endpoint.  This value must be set (see your Postman environment variable
 * for the correct value).
 */
exports.clientSecret = process.env.FORD_CLIENTSECRET;

if (exports.clientSecret === undefined || exports.clientSecret.length < 20) {
  console.log('ERROR: please set the FORD_CLIENTSECRET environment variable!');
}
