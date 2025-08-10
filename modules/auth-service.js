// modules/auth-service.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  userName: { type: String, unique: true },
  password: String,                         
  email: String,
  loginHistory: [
    {
      dateTime: Date,
      userAgent: String,
    },
  ],
});

let User;

module.exports.initialize = function () {
  return new Promise(function (resolve, reject) {
    let db = mongoose.createConnection(process.env.MONGODB);

    db.on('error', (err) => {
      reject(err); 
    });
    db.once('open', () => {
      User = db.model('users', userSchema);
      resolve();
    });
  });
};

module.exports.registerUser = function (userData) {
  return new Promise((resolve, reject) => {
    // 1) passwords must match
    if (userData.password !== userData.password2) {
      reject('Passwords do not match');
      return;
    }

    // 2) ensure loginHistory array exists
    if (!userData.loginHistory) userData.loginHistory = [];

    // 3) hash password
    bcrypt.hash(userData.password, 10)
      .then((hash) => {
        const newUser = new User({
          userName: userData.userName,
          password: hash, // store hashed password
          email: userData.email,
          loginHistory: userData.loginHistory,
        });
        return newUser.save();
      })
      .then(() => resolve())
      .catch((err) => {
        if (err && err.code === 11000) {
          reject('User Name already taken');
        } else if (err && err.message && err.message.toLowerCase().includes('data and salt')) {
          reject('There was an error encrypting the password');
        } else {
          reject('There was an error creating the user: ' + err);
        }
      });
  });
};

module.exports.checkUser = function (userData) {
  return new Promise((resolve, reject) => {
    User.find({ userName: userData.userName })
      .then((users) => {
        if (!users || users.length === 0) {
          reject('Unable to find user: ' + userData.userName);
          return;
        }

        const user = users[0];

        bcrypt.compare(userData.password, user.password)
          .then((match) => {
            if (!match) {
              reject('Incorrect Password for user: ' + userData.userName);
              return;
            }

            if (!user.loginHistory) user.loginHistory = [];
            if (user.loginHistory.length === 8) {
              user.loginHistory.pop();
            }
            user.loginHistory.unshift({
              dateTime: new Date().toString(),
              userAgent: userData.userAgent,
            });

            return User.updateOne(
              { userName: user.userName },
              { $set: { loginHistory: user.loginHistory } }
            );
          })
          .then((updateResult) => {
            if (updateResult) {
              resolve(user);
            }
          })
          .catch((err) => {
            reject('There was an error verifying the user: ' + err);
          });
      })
      .catch(() => {
        reject('Unable to find user: ' + userData.userName);
      });
  });
};