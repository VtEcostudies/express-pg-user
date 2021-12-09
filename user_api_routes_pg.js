const express = require('express');
const router = express.Router();
const userService = require('./user_service_pg');
const modelService = require('./user_model_pg');

router.get('/init', init); //init the database from sql

router.post('/register', register); //user registration email flow

router.post('/authenticate', authenticate); //authenticate username/password login

router.post('/reset', reset_post); //reset password flow - send email to user

router.post('/new_email/:id', new_email); //new email reset flow

router.post('/verify', verify); //verify a valid reset token (API flow)

router.post('/confirm', confirm); //confirm password reset (API flow)

router.get('/roles', getRoles);
router.get('/', getAll);
router.get('/page/:page', getPage);
router.get('/:id', getById);

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

function register(req, res, next) {
    console.log(`users.pg.routes.register | req.body:`, req.body);
    userService.register(req.body, req.headers.host)
        .then(user => res.json(user))
        .catch(err => next(err));
}

function authenticate(req, res, next) {
  console.log(`users.routes.pg.authenticate | req.body:`, req.body);
  userService.authenticate(req.body)
    .then(ret => { //for api, return token, etc. for view, set cookie and redirect to recent URL
      console.log('users.routes.pg.js::authenticate | SUCCESS |', ret);
      res.json(ret);
    })
    .catch(err => {
      console.dir('users.routes.pg.js::authenticate | ERROR', err);
      next(err);
    });
}

function reset(req, res, next) { // send reset email to user with reset token
    console.log(`users.routes.pg.js::reset() | req.body`, req.body);
    userService.reset(req.body.email, req.headers.host)
        .then(ret => res.json(ret))
        .catch(err => next(err));
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

function getById(req, res, next) {
    console.log(`users.routes.pg.js::getById() | req.user`, req.user);
    if (req.user.role != 'admin' && req.user.sub != req.params.id) {
        throw(`Requesting User is not authorized to GET Users by ID unless it's their own.`);
    }
    userService.getById(req.params.id)
        .then(user => user ? res.json(user) : res.sendStatus(404))
        .catch(err => next(err));
}

function update(req, res, next) {
    console.log(`users.routes.pg.js::update() | req.user`, req.user);
    if (req.user.role != 'admin' && req.user.sub != req.params.id) {
        throw(`Requesting User is not authorized to PUT Users by ID unless it's their own.`);
    }
    console.log(`update id ${req.params.id} req.body:`, req.body);
    userService.update(req.params.id, req.body, req.user)
        .then(() => res.json({}))
        .catch(err => next(err));
}

//reachable by GET, so easy to test token/email in browser
function verify(req, res, next) {
    console.log(`users.routes.pg.js::verify() | req.body:`, req.body);
    userService.verify(req.body.token)
        .then(ret => res.json(ret))
        .catch(err => next(err));
}

//can only be reached by POST, so we have control and put data in body
//confirm a password reset operation with token and new password
function confirm(req, res, next) {
    console.log(`users.routes.pg.js::confirm() | req.body:`, req.body);
    userService.confirm(req.body.token, req.body.password)
        .then(ret => res.json(ret))
        .catch(err => next(err));
}

//can only be reached by POST, so we have control and put data in body
function new_email(req, res, next) {
    console.log(`users.routes.pg.js::new_email() | req.body:`, req.body);
    if (req.user.role != 'admin' && req.user.sub != req.params.id) {
        throw(`Requesting User is not authorized to PUT Users by ID unless it's their own.`);
    }
    userService.new_email(req.params.id, req.body.email, req.headers.host)
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
