/* eslint-disable linebreak-style */

const https = require('https');

/**
 * Use this function for POST commands with data to send.
 *
 * @param {*} sendData The data to send with the POST request.
 * @param {*} options The options for the request (should include hostname, port, path, method.)
 * @returns object with statusCode and body parameters.
 */
function post(sendData, options) {
  return new Promise((resolve, reject) => {
    let data = '';
    const req = https.request(options, (res) => {
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data,
        });
      });
    });
    req.on('error', (e) => {
      let message;
      try {
        message = JSON.stringify(e);
      } catch (er) {
        message = JSON.stringify({ msg: 'An error occurred' });
      }
      reject(new Error(message));
    });
    req.write(sendData);
    req.end();
  });
}

/**
 * Use this function for POST commands with data to send.
 *
 * @param {*} options The options for the request (should include hostname, port, path, method.)
 * @param {*} encoding The encoding to use or set to undefined for default encoding.
 * @returns object with statusCode and body parameters.
 */
function get(options, encoding) {
  return new Promise((resolve, reject) => {
    let data = '';
    const req = https.request(options, (res) => {
      if (encoding !== undefined) {
        res.setEncoding(encoding);
      }
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data,
        });
      });
    });
    req.on('error', (e) => {
      let message;
      try {
        message = JSON.stringify(e);
      } catch (er) {
        message = JSON.stringify({ msg: 'An error occurred' });
      }
      reject(new Error(message));
    });
    req.end();
  });
}

/**
 * Creates form data string from an object.
 *
 * @param {*} json Converts a PJSON object into a form data string.
 * @returns a string to use as the data for POST calls.
 */
function jsonToFormData(json) {
  const body = [];
  // eslint-disable-next-line guard-for-in,no-restricted-syntax
  for (const property in json) {
    const encodedKey = encodeURIComponent(property);
    const encodedValue = encodeURIComponent(json[property]);
    body.push(`${encodedKey}=${encodedValue}`);
  }
  return body.join('&');
}

exports.get = get;
exports.post = post;
exports.jsonToFormData = jsonToFormData;
