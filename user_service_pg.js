const dbPath = '../database';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config').config;
const secrets = require('../secrets').secrets;
const db = require(`${dbPath}/db_postgres`);
const query = db.query;
const pgUtil = require(`${dbPath}/db_pgutil`);
const sendmail = require('./sendmail');
const userModel = require('./user_model_pg');
const tables = ["users", "alias"]; //setColumns tables

setColumns(); //on app start

module.exports = {
    setColumns,
    getColumns,
    authenticate,
    login,
    register,
    reset_password,
    reset_email,
    verify,
    confirm,
    check,
    getAll,
    getPage,
    getByUserId,
    getByUserName,
    getRoles,
    update,
    delete: _delete
};

//pre-populate stored array
function setColumns() {
  for (i=0; i<tables.length; i++) {
    return pgUtil.setColumns(tables[i]); //run it once on init. returns a promise. on success it returns a custom object: {tableName:, columns:}
/*
      .then(res => {return res;})
      .catch(err => {
        console.log(`users.service.pg.pgUtil.getColumns | table:${tables[i]} | error: `, err.message);
        return err;
      });
*/
  }
}

function getColumns() {
  for (i=0; i<tables.length; i++) {
    return pgUtil.getColumns(tables[i]);
  }
}

/*
  Authenticate user.
  Handle registration, reset_password, and reset_email confirmations and the
  regular login process.

  Registration, reset_password, and reset_email confirmations are different only
  in that a token is in the body (or with pug ui in a cookie). To succeed, the
  incoming token must match the db token, which was inserted during the reset
  operation. When a token is preset, query the user db with additional where
  clause "token" parameter, and on successful auth set token=null and status='confirmed'.
  Originally, we filtered user selection to 'where token is null'. However, this
  did not allow us to return users whose status is not confirmed, which prevents
  us from returning an instructive error.
*/
async function authenticate(req) {
    if (!req.body.token && req.cookies) { //IMPORTANT: with pug ui register/reset/email flow, a token from email URL is passed in req.cookies[type]
      req.body.token = req.cookies['register'] || req.cookies['reset'] || req.cookies['email'];
    }
    body = req.body;
    return new Promise(async (resolve, reject) => {
        if (!body.username || !body.password) {reject(new Error('Username and password are required.'));}
        var token = null; //authentiction token. return if successful login.
        var select = `select * from users where username=$1;`;
        var args = [body.username];
        if (body.token) {
          select = `select * from users where username=$1 and token=$2;`;
          args = [body.username, body.token];
        }
        console.log(select, args);
        const sres = await query(select, args);
        const user = sres.rows[0];
        console.log(`users.pg.service.authenticate | user: `, user);
        if (user && bcrypt.compareSync(body.password, user.hash)) {
            if (user.status=='confirmed' || body.token) { //confirmed, registration token and reset_email token
              delete user.hash; //never return hash via API
              delete user.token;
              //token = jwt.sign({ sub: user.userId, username: user.username, role: user.userrole }, secrets.token.secret, { expiresIn: secrets.token.loginExpiry });
              token = jwt.sign(user, secrets.token.secret, { expiresIn: secrets.token.loginExpiry });
              if (body.token) {
                console.log(update, args);
                var update = `update users set token=null,status='confirmed' where username=$1 and token=$2 returning *;`;
                query(update, args)
                  .then(res => resolve({"user":user, "token":token }) )
                  .catch(err => reject(err));
              } else {
                resolve ({"user":user, "token":token });
              }
            } else {
              var message = `Invalid user status: '${user.status}.' `;
              switch (user.status) {
                case 'registration':
                  message += 'Please complete the registration process using your emailed registration token.';
                  break;
                case 'reset':
                case 'reset_password':
                  message += 'Please complete the password reset process using your emailed reset token.';
                  break;
                case 'new_email':
                case 'reset_email':
                  message += 'Please complete the change of email process using your new email token.';
                  break;
                case 'invalid':
                  message = `This user is invalid. Please contact a ${config.app_servicename} administrator.`;
                  break;
                }
              reject(new Error(message));
            }
        } else {
            if (token) {
              reject(new Error('Invalid token.'));
            } else {
              reject(new Error('Username and password do not match.'));
            }
        }
    });
}

/*
  Perform a simple login based only on username and password.

  This ignores any existing reset tokens and simply verifies username and
  password for a confirmed user. It generates a new login token and returns
  a user object and new login token.

  Inputs:
    req.body.username
    req.body.password
*/
function login(req) {
  var body = req.body;
  var token = null;
  return new Promise(async (resolve, reject) => {
      if (!body.username || !body.password) {reject(new Error('Username and password are required.'));}
      var select = `select * from users where username=$1;`;
      var args = [body.username];
      console.log(`user_service_pg::login | query:`, select, args);
      const sres = await query(select, args);
      const user = sres.rows[0];
      console.log(`user_service_pg::login | user: `, user);
      if (user && bcrypt.compareSync(body.password, user.hash)) {
          if (user.status=='confirmed') {
            delete user.hash; //never return hash via API
            delete user.token;
            token = jwt.sign(user, secrets.token.secret, { expiresIn: secrets.token.loginExpiry });
            resolve({user: user, token: token});
          } else {
            reject(new Error(`Invalid user status ${user.status}.`));
          }
      } else {
        reject(new Error(`Username and password do not match.`));
      }
  });
}

/*
  Register a user with email registration token flow.
*/
function register(body, hostname) {
    return new Promise((resolve, reject) => {
        body.token = jwt.sign({ registration:true, email:body.email }, secrets.token.secret, { expiresIn: secrets.token.registrationExpiry });
        body.status = 'registration';
        body.userrole = 'user'; //default role is 'user' role.
        // hash password, add to body object, delete password from body object
        if (body.password) {
            body.hash = bcrypt.hashSync(body.password, 10);
            delete body.password;
        }

        var queryColumns = pgUtil.parseColumns(body, 1, [], [], 'users');
        text = `insert into users (${queryColumns.named}) values (${queryColumns.numbered}) returning "userId";`;
        console.log(`user_service_pg::register | INSERT query:`, text, queryColumns.values);
        query(text, queryColumns.values)
          .then(res => {
            console.log(`user_service_pg::register | rowCount:${res.rowCount}, userId:${res.rows[0].userId}`);
            sendmail.register(body.email, body.token, hostname)
              .then(ret => {resolve(ret);})
              .catch(err => { //if sendmail error is due to invalid email, we need to delete the user b/c this orphans the username w/o a valid email
                console.log(`user_service_pg::register::sendmail | ERROR:`, err.message);
                text = `delete from users where email=$1`;
                console.log(`user_service_pg::register::sendmail | DELETE query:`, text, body.email);
                query(text, [body.email])
                  .then(ret => reject(err))
                  .catch(err_del => reject({send: err, delete: err_del}));
              });
          })
          .catch(err => {
              console.log('user_service_pg::register | ERROR ', err.message);
              if (err.code == 23505 && err.constraint == 'user_pkey') {
                  err.name = 'Uniqueness Constraint Violation';
                  err.hint = 'Please choose a different username.';
                  err.message = `username '${body.username}' is already taken.`;
              }
              if (err.code == 23505 && err.constraint == 'unique_email') {
                  err.name = 'Uniqueness Constraint Violation';
                  err.hint = 'Please login with the account attached to this email.';
                  err.message = `email '${body.email}' has already registered.`;
              }
              if (err.code == 23502) {
                  err.name = 'Not-null Constraint Violation';
                  err.hint = 'Please enter all required values.';
                  delete err.detail; //contains entire existing record - insecure
              }
              reject(err);
          });
    });
}

/*
  User password reset flow.
  Call this route to set a new user password before sending a reset email/token.
  This route will invalidate the old password and send an email with reset link
  containing a reset token.
  - verify user email. if found:
  - set db reset token (for comparison on /confirm route)
  - send email with url and reset token
*/
function reset_password(email, hostname) {
    return new Promise((resolve, reject) => {
      const token = jwt.sign({ reset_password:true, email:email }, secrets.token.secret, { expiresIn: secrets.token.resetExpiry });
      text = `update users set token=$2,status='reset' where "email"=$1 returning "userId",email,token;`;
      console.log(text, [email, token]);
      query(text, [email, token])
        .then(res => {
          console.log('user_service_pg::reset_password | rowCount ', res.rowCount);
          if (res.rowCount == 1) {
            sendmail.reset_password(res.rows[0].email, res.rows[0].token, hostname)
              .then(ret => {resolve(ret);})
              .catch(err => {reject(err)});
          } else {
            console.log('user_service_pg::reset_password | ERROR', `email ${email} NOT found.`);
            reject(new Error(`email ${email} NOT found.`));
          }
        })
        .catch(err => {
          console.log('user_service_pg::reset_password | ERROR ', err.message);
          reject(err.message);
        });
    });
}

/*
  User email reset flow.
  Change user email. Call this route to set a reset_email token before
  sending a reset_email email/token. This route will emulate the registration
  flow, requiring that the user logs in from the new email token.
  - verify user email. if found:
  - set db reset_email token (for comparison on /authenticate route)
  - send email with url and reset_email token
*/
function reset_email(userId, email, hostname) {
    return new Promise((resolve, reject) => {
      const token = jwt.sign({ reset_email:true, email:email }, secrets.token.secret, { expiresIn: secrets.token.resetExpiry });
      text = `update users set email=$2,token=$3,status='reset_email' where "userId"=$1 returning "userId",email,token;`;
      console.log(text, [userId, email, token]);
      query(text, [userId, email, token])
        .then(res => {
          console.log('user_service_pg::reset_email | rowCount ', res.rowCount);
          if (res.rowCount == 1) {
            sendmail.reset_email(res.rows[0].email, res.rows[0].token, hostname)
              .then(ret => {resolve(ret);})
              .catch(err => {reject(err)});
          } else {
            console.log('user_service_pg::reset_email | ERROR', `email ${email} NOT found.`);
            reject(new Error(`email ${email} NOT found.`));
          }
        })
        .catch(err => {
          console.log('user_service_pg::reset_email | ERROR ', err.message);
          reject(err.message);
        });
    });
}

/*
  Verify a valid token that maps to a user in the db having the included email
  and token.

  We handle 3 types of tokens: registration, reset_password, and reset_email.
  When the token is parsed, it will include a payload with either reset=true or
  registration=true and an email address. By receiving this token and successfully
  decoding, this function verifies that we have a valid user matching those values
  in the database.

  The result from success here should be a one of the following:

  - If this is registration flow, show a login form where the user can enter
    their username/password combination that they entered when they registered.
    In that case the POST from the login form is routed to the authenticate
    function.

  - If this is reset flow, show a password change form where the user can enter
    a new password. In that case the POST from the password-change form is routed
    to the confirm function.
*/
function verify(token) {
  console.log('user_service_pg::verify | token', token);

  return new Promise((resolve, reject) => {
    jwt.verify(token, secrets.token.secret, function(err, payload) {
      if (err) {
        console.log('user_service_pg::verify | ERROR', err);
        reject(err);
      }
      payload.now = Date.now();
      console.dir(payload);
      //multi-use token: verify and re-verify until token expires
      var text = `select * from users where email=$1 and token=$2;`;
      console.log(text);
      query(text, [payload.email, token])
        .then(res => {
          console.log(res.rows[0]);
          if (res.rows[0]) {
            delete res.rows[0].hash; //remove password hash for security
            //delete res.rows[0].token; //Don't delete this. It was provided, it matched, and we need it downstream for the password reset flow.
            resolve(res.rows[0]);
          } else {
            reject(new Error('Cannot verify. User email/token NOT found.'))
          }
        })
        .catch(err => {
          reject(err);
        });
    });
  });
}

/*
  Confirm a new registration or password reset by verifying a user from the
  token and an email parsed from the incoming token. If that combination is
  verified, update the user's password.
*/
function confirm(token, password) {
  // hash password
  var hash = bcrypt.hashSync(password, 10);

  console.log('user_service_pg::confirm | inputs', token, hash);

  return new Promise((resolve, reject) => {
    jwt.verify(token, secrets.token.secret, function(err, payload) {
      if (err) {
        console.log('user_service_pg::confirm | ERROR', err);
        reject(err);
      }
      payload.now = Date.now();
      console.dir(payload);
      //confirm token validity and update password in one stroke...
      var text = `update users set hash=$3,token=null,status='confirmed' where "email"=$1 and "token"=$2 returning *;`;
      console.log(text);
      query(text, [payload.email, token, hash])
        .then(res => {
          console.log(res.rows[0]);
          if (res.rows[0]) {
            delete res.rows[0].hash; //remove password hash for security
            delete res.rows[0].token; //ditto
            resolve(res.rows[0]);
          } else {
            reject(new Error('Cannot confirm. User email/token NOT found.'))
          }
        })
        .catch(err => {
          reject(err);
        });
    });
  });
}

/*
  This is a legacy of the vpatlas API system. I think its purpose is to have an
  empty route to call to check the validity of the login token.

  If a request gets here, it succeeded because it made it past the auth middelware.
*/
function check(req, res) {
  return new Promise((resolve, reject) => {
    resolve(true);
  })
}

async function getAll(params={}) {
    var orderClause = 'ORDER BY "updatedAt" DESC';
    if (params.orderBy) {
        var col = params.orderBy.split("|")[0];
        var dir = params.orderBy.split("|")[1]; dir = dir ? dir : '';
        orderClause = `ORDER BY "${col}" ${dir}`;
    }
    const where = pgUtil.whereClause(params, [], 'WHERE', 'users');
    const text = `
    SELECT * FROM users
    ${where.text} ${orderClause};`;
    console.log(`user_service_pg::getAll`, text, where.values);
    try {
        var res = await query(text, where.values);
        return res.rows;
    } catch(err) {
        throw err;
    }
}

async function getPage(page, params={}) {
    page = Number(page) ? Number(page) : 1;
    const pageSize = Number(params.pageSize) ? Number(params.pageSize) : 10;
    const offset = (page-1) * pageSize;
    var orderClause = '';
    if (params.orderBy) {
        var col = params.orderBy.split("|")[0];
        var dir = params.orderBy.split("|")[1]; dir = dir ? dir : '';
        orderClause = `order by "${col}" ${dir}`;
    }
    var where = pgUtil.whereClause(params, [], 'WHERE', 'users'); //whereClause filters output against users.columns
    const text = `select (select count(*) from users ${where.text}),* from users ${where.text} ${orderClause} offset ${offset} limit ${pageSize};`;
    console.log(`user_service_pg::getPage`, text, where.values);
    try {
        var res = await query(text, where.values);
        return res.rows;
    } catch(err) {
        throw err;
    }
}

/*
 * NOTE: tried handling promise, here, with .catch, .then. Doesn't work
 * with await. Neither does it appear to work without await. See commented
 * code below.
 *
 * It does appear that await is meant to be used with the old-school try {}
 * catch {} formulation.
 */
async function getByUserId(userId) {
    try {
        var res = await query(`select * from users where "userId"=$1;`, [userId]);
        if (res.rowCount == 1) {
            delete res.rows[0].hash;
            return res.rows[0];
        } else {
            console.log(`user_service_pg::getByUserId ${userId} NOT Found`);
            return {};
        }
    } catch(err) {
        console.log(`user_service_pg::getByUserId error`, err);
        throw err;
    }
}

async function getByUserName(username) {
    try {
        var res = await query(`select * from users where "username"=$1;`, [username]);
        if (res.rowCount == 1) {
            delete res.rows[0].hash;
            return res.rows[0];
        } else {
            console.log(`user_service_pg::getByUserName ${username} NOT Found`);
            return {};
        }
    } catch(err) {
        console.log(`user_service_pg::getByUserName error`, err);
        throw err;
    }
}

async function getRoles() {
  return await query(`select * from role`);
}

/*
  Update user profile data.
  Password resets are done via the reset_password flow.
  Email changes are done via the reset_email flow.
  User values that can only be done by administrative function:
    - username
    - alias
    - role
    - status
  NOTE: checking userrole=='admin' should be sufficiently secure. We embed
  user object from db query in the auth jwt, which is not easily decoded. API access is only
  possible with auth jwt, and user.userrole cannot be set another way.
  If this is not secure enough, we could query the db for login userrole here
  to double-check.
*/
async function update(userId, body, user) {

    delete body.password; //don't allow password update here. only use reset_password flow.
    if (user.role != 'admin') { //only allow admins to set these values.
      delete body.username;
      delete body.userrole;
      delete body.alias;
      delete body.status;
    }

    /*
      We receive Alias as an array, and store in users but also in a separate
      table, alias. A database TRIGGER handles those insert/updates in postgres.
    */
    const queryColumns = pgUtil.parseColumns(body, 2, [userId], [], 'users');
    const text = `update users set (${queryColumns.named}) = (${queryColumns.numbered}) where "userId"=$1;`;
    console.log(text, queryColumns.values);
    return await query(text, queryColumns.values);
}

async function _delete(userId) {
    return await query(`delete from users where "userId"=$1;`, [userId]);
}
