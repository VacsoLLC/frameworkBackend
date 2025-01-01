import Base from '../base.js';
import jwt from 'jsonwebtoken';
import User from './login/user.js';


export default class Login extends Base {
  constructor(args) {
    super({className: 'login', ...args});
    this.authenticationRequired = false;
    this.methodAdd('getToken', this.getToken);
    this.methodAdd('forgotPassword', this.forgotPassword);
    this.methodAdd('resetPassword', this.resetPassword);
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
