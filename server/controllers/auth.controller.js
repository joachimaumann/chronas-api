import jwt from 'jsonwebtoken'
import httpStatus from 'http-status'
import Moniker from 'moniker'
import APIError from '../helpers/APIError'
import config from '../../config/config'
import User from '../models/user.model'
import userCtrl from '../controllers/user.controller'

// TODO: add email service
// var mandrill = require('node-mandrill')(process.env.MANRILL_API)

/**
 * Returns jwt token if valid username and password is provided
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function login(req, res, next) {
  User.findById(req.body.email)
    .exec()
    .then((user) => {
      if (user && req.body.email === user.email) {
        return user.comparePassword(req.body.password, (err, isMatch) => {
          if (err) {
            return next(err)
          } else if (!isMatch) {
            const err2 = new APIError('Authentication error', httpStatus.UNAUTHORIZED, true)
            return next(err2)
          }
          const token = jwt.sign({
            id: user._id,
            username: user.username,
            lastUpdated: user.lastUpdated,
            privilege: user.privilege ? user.privilege : 1
          }, config.jwtSecret)
          return res.json({
            token,
            username: user.username
          })
        })
      }
      const err = new APIError('Authentication error', httpStatus.UNAUTHORIZED, true)
      return next(err)
    })
    .catch((e) => {
      const err = new APIError('Authentication error', httpStatus.UNAUTHORIZED, true)
      return next(err)
    })
}


/**
 * Returns jwt token and registers user if email not duplicate
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */

function signup(req, res, next) {
  req.body.signup = true
  req.body.username = (req.body.first_name && req.body.last_name) ? req.body.first_name + ' ' + req.body.last_name
    : (req.body.first_name) ? req.body.first_name
      : (req.body.last_name) ? req.body.last_name : Moniker.choose()

  // TODO: add email service
  // mandrill('/messages/send', {
  //   message: {
  //     to: [{email: req.body.email, name: req.body.username}],
  //     from_email: 'noreply@chronas.org',
  //     subject: "Chronas Account Verification",
  //     text: "Thanks for signing up! This email can be used to reset your password should you ever forget it."
  //   }
  // }, function(error, response)
  // {
  //   //uh oh, there was an error
  //   if (error) console.log( JSON.stringify(error) );
  //
  //   //everything's good, lets see what mandrill said
  //   else console.log(response);
  // });

  userCtrl.create(req, res, next)
}

export default { login, signup }
