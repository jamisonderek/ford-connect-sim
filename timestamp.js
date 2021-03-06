/* eslint-disable linebreak-style */

function timestampNow() {
  let n = new Date();
  n = new Date(Date.now() - (n.getTimezoneOffset() * 60000));
  const d = n.toISOString();
  // Format is MM-DD-YYYY HH:MM:SS
  return `${d.substring(5, 10) + d.substring(4, 5) + d.substring(0, 4)} ${d.substring(11, 19)}`;
}

exports.now = timestampNow;
