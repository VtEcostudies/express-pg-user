const express = require('express');
const router = express.Router();
const userService = require('./user_service_pg');
const modelService = require('./user_model_pg');

router.get('/init', init); //init the database from sql

router.get('/register', register_get); //show the registration view - POST to /register
router.post('/register', register_post); //user registration email flow - send registration reset token email with URL to user
router.get('/confirm/registration', confirm_register_get); //handle registration email flow - verify token & show login form

router.get('/login', login_get); //show the login view - POST to /authenticate
router.post('/login', login_post); //authenticate username/password login
router.post('/authenticate', login_post); //authenticate username/password login
router.get('/logout', logout); //de-authenticate user and rediret to root
router.post('/logout', logout); //de-authenticate user and rediret to root

router.get('/reset', reset_get); //show the password reset form (POSTs to /reset)
router.post('/reset', reset_post); //reset password flow - send email to user
router.get('/confirm/reset', confirm_reset_get); //reset email flow - verify token & show password reset form
router.post('/confirm/reset', confirm_reset_post); //confirm password reset

router.post('/email/:id', new_email); //new email reset flow
router.get('/confirm/email', confirm_email_get); //handle new email flow - verify token & show login form

router.get('/roles', getRoles);
router.get('/', getAll);
router.get('/page/:page', getPage);
router.get('/:id', getByUserId);

router.put('/:id', update);
router.delete('/:id', _delete);

module.exports = router;

function init(req, res, next) {
  modelService.createUserDb()
    .then(ret => {
      console.log(`users.routes.pg.init | SUCCESS`, ret);
      res.json(ret);
    })
    .catch(err => {
      console.log(`users.routes.pg.init | ERROR`, err);
      res.json(err);
    })
}

function register_get(req, res) {
  res.render('user_register', { user: {}, error: null });
}
function register_post(req, res, next) {
    console.log(`users.pg.routes.register_post | req.body:`, req.body);
    userService.register(req.body, `${req.protocol}://${req.headers.host}`)
      .then(user => {
        res.render('user_result', { title: 'Registration Success', message: `Check your email for a registration link. (Check you 'Spam' folder)` });
      }).catch(err => next(err));
}
function confirm_register_get(req, res, next) {
  userService.verify(req.query.token)
    .then(ret => {
      res.render('user_login', { title: 'Log in to VAL Species Registry', user: ret, cancel_url: '/' });
    })
    .catch(err => {
      res.render('user_result', { title: `Registration confirmation error`, message: err.message, error: err.message, cancel_url: '/user/reset' });
    })
}

function login_get(req, res, next) {
  res.render('user_login', { user: {}, cancel_url: '/' });
}
function login_post(req, res, next) {
  console.log(`users.routes.pg.authenticate | req.body:`, req.body);
  userService.authenticate(req)
    .then(ret => {
      console.log('users.routes.pg.js::authenticate | SUCCESS |', ret);
      res.cookie('login', ret.token, { maxAge: 86400 * 1000, httpOnly: true }); // a 'login' token should not interfere with authenticate
      res.redirect('/');
    })
    .catch(err => {
      console.dir('users.routes.pg.js::authenticate | ERROR', err);
      next(err);
    });
}
function logout(req, res, next) {
  console.log(`users_routes_pg::logout_post | req.cookies['login'] BEFORE`, req.cookies['login']);
  res.cookie('login', null, { maxAge: 0 });
  delete res.cookie.login;
  delete req.user;
  console.log(`users_routes_pg::logout_post | req.cookies['login'] AFTER`, req.cookies['login']);
  res.redirect('/');
}

function reset_get(req, res, next) { //show the password reset form
  res.render('user_reset', { user: {}, cancel_url: '/' });
}
function reset_post(req, res, next) { //respond to password reset form POST - send reset email to user with reset token
    console.log(`users.routes.pg.js::reset() | req.body`, req.body);
    userService.reset(req.body.email, `${req.protocol}://${req.headers.host}`)
        .then(ret => {
          res.render('user_result', { title: 'Password Reset Success', message: `Check your email for a reset link. (Check you 'Spam' folder)` });
        })
        .catch(err => next(err));
}
function confirm_reset_get(req, res, next) { //received a reset token get from user reset email URL with token
  userService.verify(req.query.token)
    .then(ret => { //the verified token is returned with the db object as ret.token. save it as a cookie for the reset password confirmation
      res.cookie('reset', ret.token, { maxAge: 3600 * 1000, httpOnly: true });
      res.render('user_password', { title: 'Please create a new password', user: ret, cancel_url: '/', errors:[] });
    })
    .catch(err => {
      res.render('user_result', { title: `Password reset confirmation error`, message: err.message, error: err.message });
    });
}
function confirm_reset_post(req, res, next) { //password reset password entry form POST
  if (req.body.password != req.body.confirm) { //password mismatch
    res.render('user_password', { title: 'Please create a new password', user: ret, cancel_url: '/', errors:[{msg:`Password and confirmation mismatch`}] });
  } else if (!req.cookies['reset']) { //no reset token from verify passed to us?
    res.render('user_result', { title: `Password reset confirmation error`, message: 'Please retry your email link or reset your password again.', error: 'Reset again' });
  } else {
    userService.confirm(req.cookies['reset'], req.body.password)
      .then(ret => {
        res.cookie('reset', null, { maxAge:0 }); //on confirmed reset, cookie token must be removed or it causes auth error
        res.render('user_login', { title: 'Log in to VAL Species Registry', user: ret, cancel_url: '/' });
      })
      .catch(err => {
        res.render('user_result', { title: `Password reset confirmation error`, message: err.message, error: err.message });
      });
  }
}

function confirm_email_get(req, res, next) {
  userService.verify(req.query.token)
    .then(ret => {res.render('user_login', { title: 'Log in to VAL Species Registry', user: ret, cancel_url: '/' });})
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
    console.log(`users.routes.pg.js::getRoles() | req.query`, req.query);
    if (req.user.role != 'admin') throw('Requesting User is not authorized to GET User Roles.');
    userService.getRoles(req.query)
        .then(users => res.json(users))
        .catch(err => next(err));
}

function getAll(req, res, next) {
    console.log(`users.routes.pg.js::getAll() | req.user`, req.user);
    if (req.user.role != 'admin') throw('Requesting User is not authorized to GET All Users.');
    userService.getAll(req.query)
        .then(users => res.json(users))
        .catch(err => next(err));
}

function getPage(req, res, next) {
    console.log(`users.routes.pg.js::getPage() | req.user`, req.user);
    if (req.user.role != 'admin') throw('Requesting User is not authorized to GET All Users.');
    console.log('getPage req.query', req.query);
    userService.getPage(req.params.page, req.query)
        .then(users => res.json(users))
        .catch(err => next(err));
}

function getByUserId(req, res, next) {
    console.log(`users.routes.pg.js::getByUserId() | req.user`, req.user);
    if (req.user.role != 'admin' && req.user.sub != req.params.userId) {
        throw(`Requesting User is not authorized to GET Users by ID unless it's their own.`);
    }
    userService.getByUserId(req.params.userId)
        .then(user => user ? res.json(user) : res.sendStatus(404))
        .catch(err => next(err));
}

function update(req, res, next) {
    console.log(`users.routes.pg.js::update() | req.user`, req.user);
    if (req.user.role != 'admin' && req.user.sub != req.params.userId) {
        throw(`Requesting User is not authorized to PUT Users by ID unless it's their own.`);
    }
    console.log(`update id ${req.params.userId} req.body:`, req.body);
    userService.update(req.params.userId, req.body, req.user)
        .then(() => res.json({}))
        .catch(err => next(err));
}

//can only be reached by POST, so we have control and put data in body
function new_email(req, res, next) {
    console.log(`users.routes.pg.js::new_email() | req.body:`, req.body);
    if (req.user.role != 'admin' && req.user.sub != req.params.id) {
        throw(`Requesting User is not authorized to PUT Users by ID unless it's their own.`);
    }
    userService.new_email(req.params.id, req.body.email, `${req.protocol}://${req.headers.host}`)
        .then(ret => res.json(ret))
        .catch(err => next(err));
}

function _delete(req, res, next) {
    console.log(`users.routes.pg.js::delete() | req.user`, req.user);
    if (req.user.role != 'admin') throw('Requesting User is not authorized to DELETE Users.');
    userService.delete(req.params.id)
        .then(() => res.json({}))
        .catch(err => next(err));
}
