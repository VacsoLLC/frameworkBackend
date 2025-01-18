import Base from '../base.js';
import jwt from 'jsonwebtoken';
import User from './login/user.js';
import * as validators from './login_schema.js';

export default class Login extends Base {
  constructor(args) {
    super({className: 'login', ...args});
    this.authenticationRequired = false;

    this.methodAdd({
      id: 'getToken',
      method: this.getToken,
      validator: validators.getToken,
    });

    this.methodAdd({
      id: 'forgotPassword',
      method: this.forgotPassword,
      validator: validators.forgotPassword,
    });

    this.methodAdd({
      id: 'resetPassword',
      method: this.resetPassword,
      validator: validators.resetPassword,
    });

    this.methodAdd({
      id: 'createAccount',
      method: this.createAccount,
      validator: validators.createAccount,
    });
  }

  // TODO: add rate limiting to this function and authenticateUser to prevent brute force attacks
  async getToken({email, password, req}) {
    const user = await this.authenticateUser({email, password, req});

    if (!user) {
      console.log('Authentication failed');

      throw new Error('Authentication failed');
    }

    console.log('Authentication successful');
    const token = this._createToken({user});
    return {
      message: 'Authentication successful',
      token,
    };
  }

  async forgotPassword({email, req}) {
    return this.packages.core.user.generatePasswordResetToken({email, req});
  }

  async resetPassword({token, password, req}) {
    return this.packages.core.user.resetForgottenPassword({
      token,
      password,
      req,
    });
  }

  async createAccount({token, password, fullName, req}) {
    return this.packages.core.user.setPasswordForNewAccountUsingInviteToken({
      token,
      password,
      fullName,
      req,
    });
  }

  async authenticateUser({email, password, req}) {
    console.log('Logging in', email);

    const user = await this.packages.core.user.auth(email, password, req);

    if (!user) {
      return null;
    }

    return {
      ...user,
    };
  }

  _createToken({user}) {
    return jwt.sign(user, this.config.token.secret, this.config.token.options);
  }

  verifyToken({token}) {
    return jwt.verify(token, this.config.token.secret);
  }

  /**
   * Retrieves user information from a token.
   * @param {Object} options - The options object.
   * @param {string} options.token - The token to verify and retrieve user information from.
   * @returns {User|boolean} - The user object if the token is verified successfully, otherwise false.
   */
  userFromToken({token}) {
    try {
      // Verify the token
      const verified = this.verifyToken({token});
      console.log('Verified user token.', verified);
      const user = new User({
        ...verified,
        packages: this.packages,
      });
      return user;
    } catch (error) {
      return false;
    }
  }
}
