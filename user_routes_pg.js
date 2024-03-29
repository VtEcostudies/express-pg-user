const express = require('express');
const router = express.Router();
const userService = require('./user_service_pg');
const modelService = require('./user_model_pg');

router.get('/db/create', createDb); //create the database from sql
router.get('/db/init', setColumns); //initialize pgutil: populate array of columns in user tables to handle db requests
router.get('/db/columns', getColumns); //send json user db columns

router.get('/register', register_get); //show the registration view - POST to /register
router.post('/register', register_post); //user registration email flow - send registration reset token email with URL to user
router.get('/confirm/registration', confirm_register_get); //handle registration email flow - verify token & show login form with altered POST route (/confirm/registration)
router.post('/confirm/registration', confirm_register_post); //handle

router.get('/login', login_get); //show the login view - POST to /authenticate
router.post('/login', login_post); //authenticate username/password login
router.post('/authenticate', login_post); //authenticate username/password login
router.get('/logout', logout); //de-authenticate user and rediret to root
router.post('/logout', logout); //de-authenticate user and rediret to root

router.get('/reset', reset_get); //password reset flow: show the password reset form (which POSTs to /reset route)
router.post('/reset', reset_post); //reset password flow: POST sends password-reset email to user
router.get('/confirm/reset', confirm_reset_get); //reset password flow - received reset email: verify token & show password reset form
router.post('/confirm/reset', confirm_reset_post); //confirm password reset

router.post('/email/:id', email_post); //email reset flow
router.get('/confirm/email', confirm_email_get); //handle new email flow - verify token & show login form

router.get('check', (req, res) => {userService.check().then(ret => res.json(ret))});

router.get('/roles', getRoles);
router.get('/', getAll);
router.get('/page/:page', getPage);
router.get('/:id', getByUserId);

router.put('/:id', update);
router.delete('/:id', _delete);

module.exports = router;

function createDb(req, res, next) {
  modelService.createUserDb()
    .then(ret => {
      console.log(`users.routes.pg.init | SUCCESS`, ret);
      res.json(ret);
    })
    .catch(err => {
      console.log(`users.routes.pg.init | ERROR`, err);
      next(err);
    })
}

function setColumns(req, res, next) {
  userService.setColumns()
    .then(ret => res.json(ret))
    .catch(err => next(err));
}

function getColumns(req, res, next) {
  userService.getColumns()
    .then(ret => res.json(ret))
    .catch(err => next(err));
}

function register_get(req, res) {
  res.render('user_register', { user: false, error: null });
}
function register_post(req, res, next) {
    console.log(`users.pg.routes.register_post | req.body:`, req.body);
    userService.register(req.body, `${req.protocol}://${req.headers.host}`)
      .then(user => {
        res.render('user_result', { title: 'Registration Success', message: `Check your email for a registration link. (Check your 'Spam' folder)` });
      }).catch(err => next(err));
}
function confirm_register_get(req, res, next) {
  userService.verify(req.query.token)
    .then(ret => {
      res.cookie('register', ret.token, { maxAge: 3600 * 1000, httpOnly: true });
      res.render('user_login', { title: 'Log in to Complete your Registration', post_action: '/user/confirm/registration', user: {username: ret.username} });
    })
    .catch(err => {
      res.render('user_result', { title: `Registration confirmation error`, message: err.message, error: err.message, cancel_url: '/user/reset' });
    })
}
function confirm_register_post(req, res, next) {
  userService.confirm(req.cookies['register'], req.body.password)
    .then(ret => {
      res.cookie('register', null, { maxAge:0 }); //on confirmed registration, cookie token must be removed or it causes authenticate error
      delete res.cookie.register; //not sure if this works...
      userService.login(req)
        .then(ret => {
          res.cookie('login', ret.token, { maxAge: 86400 * 1000, httpOnly: true });
          res.redirect('/'); //redirect should call routig middlware which sets req.user from valid login token
        })
    })
    .catch(err => { //try again on pasword. req.cookies['register'] should still be valid.
      res.render('user_login', { title: 'Log in to Complete your Registration', post_action: '/confirm/registration', user: {username: ret.username} });
    })
}

function login_get(req, res, next) {
  res.render('user_login', { title: 'Log in to VAL Species Registry', user: false });
}
function login_post(req, res, next) {
  console.log(`users_routes_pg::login_post | req.body:`, req.body);
  console.log('users_routes_pg::login_post | req.cookies', req.cookies);
  userService.authenticate(req)
    .then(ret => {
      console.log('user_routes_pg::authenticate | SUCCESS |', ret);
      res.cookie('login', ret.token, { maxAge: 86400 * 1000, httpOnly: true }); // a 'login' token should not interfere with authenticate
      res.redirect('/');
    })
    .catch(err => {
      console.dir('user_routes_pg::authenticate | ERROR', err);
      next(err);
    });
}
function logout(req, res, next) {
  console.log(`users_routes_pg::logout_post | req.cookies['login'] BEFORE`, req.cookies['login']);
  res.cookie('login', null, { maxAge: 0 });
  delete res.cookie.login;
  delete req.cookies.login;
  delete req.user;
  console.log(`users_routes_pg::logout_post | req.cookies['login'] AFTER`, req.cookies['login']);
  res.redirect('/');
}

function reset_get(req, res, next) { //show the password reset form
  res.render('user_reset', { user: false, cancel_url: '/' });
}
function reset_post(req, res, next) { //respond to password reset form POST - send reset email to user with reset token
    console.log(`user_routes_pg::reset() | req.body`, req.body);
    userService.reset_password(req.body.email, `${req.protocol}://${req.headers.host}`)
        .then(ret => {
          res.render('user_result', { title: 'Password Reset Success', message: `Check your email for a reset link. (Check your 'Spam' folder)` });
        })
        .catch(err => next(err));
}
function confirm_reset_get(req, res, next) { //received a reset token get from user reset email URL with token
  userService.verify(req.query.token)
    .then(ret => { //the verified token is returned with the db object as ret.token. save it as a cookie for the reset password confirmation
      res.cookie('reset', ret.token, { maxAge: 3600 * 1000, httpOnly: true });
      res.render('user_password', { title: 'Please create a new password', user: false, cancel_url: '/', errors:[] });
    })
    .catch(err => {
      res.render('user_result', { title: `Password reset confirmation error`, message: err.message, error: err.message });
    });
}
function confirm_reset_post(req, res, next) { //password reset password entry form POST
  if (req.body.password != req.body.confirm) { //password mismatch
    res.render('user_password', { title: 'Please create a new password', user: false, cancel_url: '/', errors:[{msg:`Password and confirmation mismatch`}] });
  } else if (!req.cookies['reset']) { //no reset token cookie in POST from verify passed to us
    res.render('user_result', { title: `Password reset confirmation error`, message: 'No reset token. Please retry your email link or reset your password again.', error: 'Reset again' });
  } else {
    userService.confirm(req.cookies['reset'], req.body.password)
      .then(ret => {
        res.cookie('reset', null, { maxAge:0 }); //on confirmed reset, cookie token must be removed or it causes auth error
        res.render('user_login', { title: 'Log in to VAL Species Registry', user: false });
      })
      .catch(err => {
        res.render('user_result', { title: `Password reset confirmation error`, message: err.message, error: err.message });
      });
  }
}

//NOTE: the reset_email flow for pug ui has not been written. This is leftover re-factored API code. To make it work,
//emulate the reset_password flow for pug ui, above, which does work.
function confirm_email_get(req, res, next) {
  userService.verify(req.query.token)
    .then(ret => {res.render('user_login', { title: 'Log in to VAL Species Registry', user: false });})
    .catch(err => {
      res.render('user_result', { title: `New email confirmation error`, message: err.message, error: err.message, cancel_url: '/user/reset' })
    })
}

function check(req, res, next) {
    console.log(`users.pg.routes.check | req.body:`, req.body);
    userService.check(req.body)
        .then(user => res.json(user))
        .catch(err => next(err));
}

function getRoles(req, res, next) {
    console.log(`user_routes_pg::getRoles() | req.query`, req.query);
    if (req.user.role != 'admin') throw('Requesting User is not authorized to GET User Roles.');
    userService.getRoles(req.query)
        .then(users => res.json(users))
        .catch(err => next(err));
}

function getAll(req, res, next) {
    console.log(`user_routes_pg::getAll() | req.user`, req.user);
    if (req.user.role != 'admin') throw('Requesting User is not authorized to GET All Users.');
    userService.getAll(req.query)
        .then(users => res.json(users))
        .catch(err => next(err));
}

function getPage(req, res, next) {
    console.log(`user_routes_pg::getPage() | req.user`, req.user);
    if (req.user.role != 'admin') throw('Requesting User is not authorized to GET All Users.');
    console.log('getPage req.query', req.query);
    userService.getPage(req.params.page, req.query)
        .then(users => res.json(users))
        .catch(err => next(err));
}

function getByUserId(req, res, next) {
    console.log(`user_routes_pg::getByUserId() | req.user`, req.user);
    if (req.user.role != 'admin' && req.user.sub != req.params.userId) {
        throw(`Requesting User is not authorized to GET Users by ID unless it's their own.`);
    }
    userService.getByUserId(req.params.userId)
        .then(user => user ? res.json(user) : res.sendStatus(404))
        .catch(err => next(err));
}

function update(req, res, next) {
    console.log(`user_routes_pg::update() | req.user`, req.user);
    if (req.user.role != 'admin' && req.user.sub != req.params.userId) {
        throw(`Requesting User is not authorized to PUT Users by ID unless it's their own.`);
    }
    console.log(`update id ${req.params.userId} req.body:`, req.body);
    userService.update(req.params.userId, req.body, req.user)
        .then(() => res.json({}))
        .catch(err => next(err));
}

//can only be reached by POST, so we have control and put data in body
function email_post(req, res, next) {
    console.log(`user_routes_pg::new_email() | req.body:`, req.body);
    if (req.user.role != 'admin' && req.user.sub != req.params.id) {
        throw(`Requesting User is not authorized to PUT Users by ID unless it's their own.`);
    }
    userService.reset_email(req.params.userId, req.body.email, `${req.protocol}://${req.headers.host}`)
        .then(ret => res.json(ret))
        .catch(err => next(err));
}

function _delete(req, res, next) {
    console.log(`user_routes_pg::delete() | req.user`, req.user);
    if (req.user.role != 'admin') throw('Requesting User is not authorized to DELETE Users.');
    userService.delete(req.params.id)
        .then(() => res.json({}))
        .catch(err => next(err));
}
