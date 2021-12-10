const jwt = require('jsonwebtoken');
const config = require('../config').config;
const secrets = require('../secrets').secrets;

module.exports = auth_token_handler;

/*
  https://stackoverflow.com/questions/33246028/save-token-in-local-storage-using-node
  https://stackoverflow.com/questions/34589272/how-to-set-authorization-headers-with-nodejs-and-express
*/
function auth_token_handler(req, res, next) {
  //console.log('auth_token_handler | req.headers:', req.headers);
  //console.log('auth_token_handler | req.cookies:', req.cookies);
  var found = match_route(req);

  if (found) { //this is an open route: auth not required
      verify(req) //find the token for user login info
        .then(payload => req.user = payload)
        .catch(err => {}); //do nothing on openRoute token error
      next();
    } else { //this is a protected route: auth required
      verify(req)
        .then(payload => {
          req.user = payload;
          next();
        })
        .catch(err => { //token verify failed
          next(err);
        })
    }
};

function match_route(req) {
  const route = req.baseUrl + req.path;
  var match, found = null;

  console.log('auth_token_handler::find_route | req.baseUrl + req.path:', route);

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

  openRoutes.forEach((ele, idx, arr) => {
    //match = route.match(ele); if (match) {
    if (route == ele) {
      found = route
      console.log(`auth_token_handler::findRoute | Found '${route}' at openRoutes[${idx}]:`, ele);
    };
  });

  return found;
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
      var notoke = new Error(`No authorization header. No login token.`);
      notoke.status = 401;
      reject(notoke);
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
