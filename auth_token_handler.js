const jwt = require('jsonwebtoken');
const config = require('../config').config;
const secrets = require('../secrets').secrets;

module.exports = auth_token_handler;

/*
  https://stackoverflow.com/questions/33246028/save-token-in-local-storage-using-node
  https://stackoverflow.com/questions/34589272/how-to-set-authorization-headers-with-nodejs-and-express
*/
function auth_token_handler(req, res, next) {
  const token = req.headers.authorization || req.cookies.login;
  const route = req.baseUrl + req.path;
  console.log('auth_token_handler | req.headers:', req.headers);
  console.log('auth_token_handler | req.cookies:', req.cookies);
  console.log('auth_token_handler | req.baseUrl + req.path:', req.baseUrl + req.path);
  //match open paths. call next(err) to stop propgation...
  var openRoutes = [ //add standard user openRoutes here
    '/user/authenticate',
    '/user/login',
    '/user/logout',
    '/user/register',
    '/user/reset',
    '/user/verify',
    '/user/confirm',
    '/user/confirm/reset',
    '/user/confirm/registration',
    '/user/confirm/email',
    '/user/password'
  ];
  openRoutes = openRoutes.concat(config.openRoutes); //get application-specific openRoutes from config.js

  var match, found = null;
  openRoutes.forEach((ele, idx, arr) => {
    match = route.match(ele);
    //if (match) {
    if (route == ele) {
      found = route
      console.log(`Found ${route} in openRoutes[${idx}]: ${ele} | `, match);
    };
  });

  if (found) {
      verify(req)
        .then(payload => req.user = payload)
        .catch(err => {}); //do nothing on openRoute token error
      next();
    } else {
      verify(req)
        .then(payload => {
          req.user = payload;
          next();
        })
        .catch(err => {
          next(err);
        })
    }
};

function verify(req) {
  const token = req.headers.authorization || req.cookies.login;

  if (token && token.includes('Bearer')) {
    console.log(`auth_token_handler::verify | found "Bearer" in token, REMOVING...`, token);
    token = token.replace('Bearer', '');
    token = token.trim();
    console.log(`auth_token_handler:verify | REMOVED "Bearer" from token:`, token);
  }

  return new Promise(async (resolve, reject) => {
    if (!token) {
      var tokerr = new Error(`No authorization header. No 'cookies.login' token.`);
      tokerr.status = 401;
      reject(tokerr);
    } else {
      try {
        await jwt.verify(token, secrets.token.secret, (err, payload) => {
          if (err) {
            console.log('auth_token_handler::verify | ERROR:', err.message);
            err.status = 401;
            reject(err);
          } else {
            payload.now = Date.now();
            console.log('auth_token_handler::verify | token payload:', payload);
            resolve(payload);
          }
        });
      } catch(err) {
        console.log('auth_token_handler::verify::try-catch | ERROR:', err.message);
        err.status = 401;
        reject(err);
      }
    }
  });
}
