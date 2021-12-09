const expressJwt = require('express-jwt');
const config = require('../config').config;
const secrets = require('../secrets').secrets
//const userService = require('./user_service_pg');

module.exports = expJwt;

/*
  https://hptechblogs.com/using-json-web-token-for-authentication/
  https://www.npmjs.com/package/express-jwt
  How express-jwt parses the request is opaque here. However, via Postman include an Authorization Request Header:
  Header Type: Authorization, Bearer Token
  Example: Key: Authorization, Value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1YzhmZmM5YTBmYWViNjIyMWMwNmM5NzgiLCJpYXQiOjE1NTI5OTIwODV9.PRQffRTZZ4jLQ-7nkEtQQ0BFdLsnB5FBmgmLyFyqv90

  https://stackoverflow.com/questions/33246028/save-token-in-local-storage-using-node
 */
function expJwt() {
  const secret = secrets.token.secret;
  const algorithms = secrets.token.algorithms;
  /*
    public routes that don't require authentication
    https://stackoverflow.com/questions/30559158/handling-parameterised-routes-in-express-jwt-using-unless
  */
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
    '/user/confirm/new_email',
    '/user/password'
  ];
  openRoutes = openRoutes.concat(config.openRoutes); //get application-specific openRoutes from config.js

  console.log('exp_jwt::expJwt | openRoutes', openRoutes);

  return expressJwt({ secret, algorithms, isRevoked }).unless({
        path: openRoutes
    });
}

/*
    NOTE - here is explanation on how to use express-jwt:
        https://github.com/auth0/express-jwt#usage
    It's as simple as this:
        jwt adds req.user to the req object. use it.
        if it's missing values, we can add them here by setting req.user
    Actually, it's more secure to use a user record retrieved from the DB
    here, than to trust the values in the incoming token. Use that, instead.
*/
async function isRevoked(req, payload, done) {

    console.log(`jwt.js::isRevoked()
                req.body:[${Object.keys(req.body)}] [${Object.values(req.body)}]
                payload:[${Object.keys(payload)}] [${Object.values(payload)}]`
                );
/*
    if (payload.sub) { //the old, angular way
      req.user = await userService.getByUserId(payload.sub);
    }
*/
    payload.now = Date.now();
    req.user = payload;

    // revoke token if user no longer exists or not found
    if (!req.user.userId) {
        return done(null, true);
    }

    console.log('jwt.js | req.user', req.user);

    return done();
};
