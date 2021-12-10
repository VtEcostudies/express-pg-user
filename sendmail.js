const nodemailer = require('nodemailer');
const config = require('../config').config;
const secrets = require('../secrets').secrets;

module.exports = {
    register: (userMail, token, protHost) => reset(userMail, token, protHost, 'registration'),
    reset_password: (userMail, token, protHost) => reset(userMail, token, protHost, 'reset'),
    reset_email: (userMail, token, protHost) => reset(userMail, token, protHost, 'email')
};

/*
Send registration or reset email with token.
*/
function reset(userMail, token, protHost, type='registration') {

  //console.log('sendmail::reset', userMail, token, type, secrets.mail.vceEmail, secrets.mail.vcePassW)
  console.log('sendmail::reset', protHost, secrets.mail.vceEmail, secrets.mail.vcePassW);

  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: secrets.mail.vceEmail,
      pass: secrets.mail.vcePassW
    },
    from: secrets.mail.vceEmail
  });

  var url = `<a href=${protHost}/user/confirm/registration?token=${token}>Confirm ${config.app_servicename} Registration</a>`;
  var sub = `${config.app_servicename} Registration`;
  if (type == 'reset') {
    url = `<a href=${protHost}/user/confirm/reset?token=${token}>Confirm ${config.app_servicename} Password Change</a>`;
    sub = `${config.app_servicename} Password Reset`;
  }
  if (type == 'email') {
    url = `<a href=${protHost}/user/confirm/email?token=${token}>Confirm ${config.app_servicename} Email Change</a>`;
    sub = `${config.app_servicename} Email Change`;
  }

  var mailOptions = {
    from: secrets.mail.vceEmail,
    to: userMail,
    subject: sub,
    html: url
  };

  console.log('sendMail::reset', mailOptions);

  /*
  To make sendmail work, log-in to the sending gmail account and turn-on 'less secure app access':
  - https://myaccount.google.com/lesssecureapps
  */
  return new Promise(function(resolve, reject) {
      transporter.sendMail(mailOptions, function(err, info) {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        console.log('Email sent: ' + info.response);
        resolve(info);
      }
    });
  });

}
