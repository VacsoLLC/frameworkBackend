import path from 'path';
import {getPasswordStrength, systemRequest} from '../../../util.js';
import Table from '../table.js';
import bcrypt from 'bcrypt';
import {fileURLToPath} from 'url';
import humanizeDuration from 'humanize-duration';

import {RateLimiterMemory} from 'rate-limiter-flexible';

import {z} from 'zod';

export default class UserTable extends Table {
  constructor(args) {
    super({name: 'User', className: 'user', ...args});

    this.limiterFailedLoginUser = new RateLimiterMemory({
      keyPrefix: 'limiterFailedLoginUser',
      points: this.config.limiter?.failedLogin?.user?.points || 5,
      duration: this.config.limiter?.failedLogin?.user?.duration || 60 * 5, // Store number for five minutes
    });

    this.limiterFailedLoginIp = new RateLimiterMemory({
      keyPrefix: 'limiterFailedLoginIp',
      points: this.config.limiter?.failedLogin?.ip?.points || 10,
      duration: this.config.limiter?.failedLogin?.ip?.duration || 60 * 5, // Store number for five minutes
    });

    this.rolesWriteAdd('Admin');
    this.rolesDeleteAdd('Admin');
    this.rolesReadAdd('Admin');
    //this.rolesReadAdd('Authenticated');

    this.addAccessFilter(async (user, query) => {
      if (user && !(await user.userHasAnyRoleName('Admin'))) {
        query.where('id', user.id);
      }
      return [query];
    });

    this.columnAdd({
      columnName: 'name',
      friendlyName: 'Full Name',
      columnType: 'string',
      index: true,
      helpText: 'The full name of the user',
      rolesRead: ['Authenticated'],
    });

    this.columnAdd({
      columnName: 'password',
      friendlyName: 'Password',
      columnType: 'password',
      helpText: 'The password of the user',
      hidden: true,
    });

    this.columnAdd({
      columnName: 'passwordResetToken',
      friendlyName: 'Password Reset Token',
      columnType: 'string',
      hidden: true,
    });

    this.columnAdd({
      columnName: 'passwordResetExpiry',
      friendlyName: 'Password Reset Expiry',
      columnType: 'datetime',
      hidden: true,
    });

    this.columnAdd({
      columnName: 'email',
      friendlyName: 'Email Address',
      columnType: 'email',
      index: true,
      unique: true,
      helpText: 'The email address of the user',
      rolesRead: ['Authenticated'],
      onCreateOrUpdate: (email) => {
        return email?.toLowerCase();
      },
    });

    this.columnAdd({
      columnName: 'loginAllowed',
      friendlyName: 'Login Allowed',
      columnType: 'boolean',
      fieldType: 'boolean',
      defaultValue: true,
      helpText: 'Is the user allowed to login?',
    });

    this.columnAdd({
      columnName: 'title',
      friendlyName: 'Job Title',
      columnType: 'string',
      helpText: 'The job title of the user',
      rolesRead: ['Authenticated'],
    });

    this.columnAdd({
      columnName: 'department',
      friendlyName: 'Department',
      columnType: 'string',
      helpText: 'The department of the user',
      rolesRead: ['Authenticated'],

      index: true,
    });

    this.columnAdd({
      columnName: 'office',
      friendlyName: 'Office phone',
      columnType: 'phone',
      helpText: 'The office phone number of the user',
      rolesRead: ['Authenticated'],
    });

    this.columnAdd({
      columnName: 'cell',
      friendlyName: 'Cell phone',
      columnType: 'phone',
      helpText: 'The cell phone number of the user',
      rolesRead: ['Authenticated'],
    });

    this.columnAdd({
      columnName: 'fax',
      friendlyName: 'Fax Number',
      columnType: 'phone',
      helpText: 'The fax number of the user',
      rolesRead: ['Authenticated'],
    });

    this.addMenuItem({
      label: 'Users',
      parent: 'Admin',
      icon: 'User',
      order: 1,
    });

    this.actionAdd({
      label: 'Reset Password',
      method: this.resetPassword,
      rolesExecute: ['Admin', 'Authenticated'],
      verify:
        'Enter a new password in the first field, and confirm it in the second field.',
      inputs: {
        Password: {
          fieldType: 'password',
          required: true,
          requiresStrengthCheck: true,
        },
        'Verify Password': {
          fieldType: 'password',
          required: true,
          requiresStrengthCheck: false,
        },
      },
      validator: z.object({
        Password: z.string(),
        'Verify Password': z.string(),
      }),
    });

    // A special user that is used for system actions
    this.addRecord({
      name: 'System',
      email: 'System@localhost',
    });

    // this is a default record that will get added after the table is created
    this.addRecord({
      name: 'admin',
      email: 'admin',
      loginAllowed: true,
      password: () => {
        const password =
          process.env.ADMIN_PASSWORD ||
          this.generatePassword({
            length: 20,
          });
        console.log('Admin Password: ', password);
        return password;
      },
    }); //

    // give the admin user the admin role
    this.addRecord({
      id: 1,
      id1: 2, // ID of admin role that is auto created
      id2: 2, // ID of the admin user that is auto created
      packageName: 'core',
      className: 'user_role',
    }); //

    this.methodAdd({
      id: 'findUserByPhoneNumber',
      method: this.findUserByPhoneNumber,
      validator: z.object({recordId: z.string()}),
    });
  }

  async findUserByPhoneNumber({recordId, req}) {
    // look up user by phone number here, return a navigate to that record.
    // use frontend route such as: https://localhost:5173/core/user/action/findUserByPhoneNumber/3148036439
    // https://localhost:5173/core/user/action/findUserByPhoneNumber/3143843354

    const officeRecord = await this.knex(this.table)
      .select('id')
      .where({office: recordId})
      .first();

    if (officeRecord) {
      return {
        navigate: `/core/user/${officeRecord.id}`,
      };
    }

    const cellRecord = await this.knex(this.table)
      .select('id')
      .where({cell: recordId})
      .first();

    if (cellRecord) {
      return {
        navigate: `/core/user/${cellRecord.id}`,
      };
    }

    return {
      message: `Couldn't find a user with that phone number (Office or Cell). Trying to match phone number: ${recordId}.`,
    };
  }

  async objectToSearchText(object) {
    return `${object.name} ${object.email}`;
  }

  async resetPassword({
    recordId,
    Password,
    'Verify Password': verifyPassword,
    req,
  }) {
    const {requiredPasswordStrength} = this.config.general;
    if (process.env.DEMO_MODE == 'true') {
      throw new Error('Password resets are disabled in demo mode.');
    }

    if (!Password || !verifyPassword) {
      throw new Error('Password and Verify Password are required.');
    }

    if (Password !== verifyPassword) {
      throw new Error('Password and Verify Password must match.');
    }

    const passwordStrength = getPasswordStrength(Password);
    if (passwordStrength < requiredPasswordStrength) {
      throw new Error('Password should be strong');
    }

    return await this.recordUpdate({
      recordId,
      data: {
        password: Password,
      },
      req,
    });
  }

  async resetForgottenPassword({token, password, req}) {
    const {requiredPasswordStrength} = this.config.general;
    const passwordStrength = getPasswordStrength(password);

    if (passwordStrength.score < requiredPasswordStrength) {
      throw new Error('Password should be strong');
    }

    const user = await this.get({
      where: {passwordResetToken: token},
    });

    if (!user) {
      throw new Error('Invalid token');
    }
    const currentTime = new Date().getTime();
    if (user.passwordResetExpiry < currentTime) {
      throw new Error('Token expired');
    }

    return this.recordUpdate({
      recordId: user.id,
      data: {
        password,
      },
      req: systemRequest(this),
      audit: false,
    });
  }

  async setPasswordForNewAccountUsingInviteToken({
    token,
    password,
    fullName,
    req,
  }) {
    const {requiredPasswordStrength} = this.config.general;

    const passwordScore = getPasswordStrength(password);

    if (passwordScore.score < requiredPasswordStrength) {
      throw new Error('Password should be strong');
    }
    const invite = await this.packages.core.invite.recordGet({
      where: {token},
      req,
    });

    if (!invite || invite.used) {
      throw new Error('Invalid token, or token has already been used');
    }

    const user = await this.recordGet({where: {email: invite.email}, req});

    if (user) {
      throw new Error('User already exists');
    }

    await this.packages.core.invite.recordUpdate({
      recordId: invite.id,
      data: {
        used: true,
      },
      req: systemRequest(this),
    });

    return this.recordCreate({
      data: {
        email: invite.email,
        password,
        name: fullName,
      },
      req: systemRequest(this),
      audit: true,
    });
  }

  async generatePasswordResetToken({email, req}) {
    const {baseURL} = this.config.general;
    const {expiryTime, enabled} = this.config.forgotPassword;

    if (!enabled) {
      throw new Error('Password reset is disabled. Please contact support.');
    }

    const user = await this.get({
      where: {email: email.toLowerCase(), loginAllowed: true},
    });

    if (!user) {
      // We purposely send a positive response. This is to prevent users from knowing if an email is in the system or not.
      return {
        message:
          'If email address was found, a password reset link has been sent.',
      };
    }

    const token = crypto.randomUUID();
    const expiry = new Date().getTime() + expiryTime * 60 * 1000;

    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    const emailBodyTemplate = await this.packages.core.email.compileTemplate(
      path.join(__dirname, 'user', 'passwordResetWithLinkEmailBody.hbs'),
    );

    const emailContent = {
      body: emailBodyTemplate({
        resetLink: `${baseURL ?? 'https://localhost:5173'}/reset-password?token=${token}`,
        expiry: humanizeDuration(expiryTime * 60 * 1000),
      }),
      subject: 'Password Reset',
      to: user.email,
    };

    const results = await this.packages.core.email.sendEmail({
      email: emailContent,
      provider: this.config.email.defaultMailbox,
    });

    if (results) {
      await this.recordUpdate({
        recordId: user.id,
        data: {
          passwordResetToken: token,
          passwordResetExpiry: expiry,
        },
        req,
        audit: false,
      });
      return {
        message:
          'If email address was found, a password reset link has been sent.',
      };
    }
    return {message: 'Failed to generate password reset token'};
  }

  async auth(email, password, req) {
    const limiterUser = await this.limiterFailedLoginUser.get(email);
    const limiterIp = await this.limiterFailedLoginIp.get(req.ip);

    if (limiterIp !== null && limiterIp.remainingPoints <= 0) {
      // Block for 15 minutes. We do this manually becuase this library only blocks after you try to consume too many. Also this will reset the failure timer each over limit try.
      this.limiterFailedLoginIp.block(
        req.ip,
        this.config.limiter?.failedLogin?.ip?.block || 60 * 15,
      );
      throw new Error(
        'Too many failed login attempts. Please try again later.',
      );
    }

    if (limiterUser !== null && limiterUser.remainingPoints <= 0) {
      // Block for 15 minutes. We do this manually becuase this library only blocks after you try to consume too many. Also this will reset the failure timer each over limit try.
      this.limiterFailedLoginUser.block(
        email,
        this.config.limiter?.failedLogin?.user?.block || 60 * 15,
      );
      throw new Error(
        'Too many failed login attempts. Please try again later.',
      );
    }

    const user = await this.get({
      where: {email: email.toLowerCase(), loginAllowed: true},
    });

    if (user && (await this.passwordMatch(password, user.password))) {
      return user;
    }

    await this.limiterFailedLoginUser.consume(email);
    await this.limiterFailedLoginIp.consume(req.ip);
    return false;
  }

  async getUserLoginAllowed(email) {
    return this.get({where: {email, loginAllowed: true}});
  }

  async getUser(email) {
    return this.get({where: {email}});
  }

  async getUserOrCreate(email) {
    const user = await this.getUser(email);
    if (user) {
      return user;
    }

    const userid = await this.recordCreate({
      data: {
        email,
        name: email,
        loginAllowed: false,
      },
      req: {
        user: {
          id: '0',
        },
        action: 'Ticket Create from Email',
      },
    });

    const newUser = await this.getUser(email);

    if (newUser) {
      return newUser;
    } else {
      throw new Error('Failed to create user');
    }
  }

  async get({where}) {
    const user = await this.recordGet({where, _returnPasswords: true});

    if (!user) {
      return false;
    }

    const groups = await this.packages.core.user_group.rowsGet({
      where: {id2: user.id},
    });

    user.groups = groups.rows.map((group) => group.id1);

    const user_roles = await this.packages.core.user_role.rowsGet({
      where: {id2: user.id},
    });

    const group_roles = await this.packages.core.group_role.rowsGet({
      where: {id2: user.id},
    });

    user.roles = this.combineUnique(
      user_roles.rows.map((role) => role.id1),
      group_roles.rows.map((role) => role.id1),
      [1], // Everyone gets role 1, which is authenticated
    );
    return user;
  }

  combineUnique(arr1, arr2, arr3 = []) {
    // Combine the two arrays and remove duplicates by converting to a Set, then back to an array
    const combinedUniqueArray = [...new Set([...arr1, ...arr2, ...arr3])];
    return combinedUniqueArray;
  }

  async passwordMatch(enteredPassword, storedHash) {
    try {
      const match = await bcrypt.compare(enteredPassword, storedHash);
      if (match) {
        // Passwords match
        console.log('Passwords match');
        return true;
      } else {
        // Passwords don't match
        console.log('Passwords do not match');
        return false;
      }
    } catch (error) {
      console.error('Error comparing passwords:', error);
      return false;
    }
  }

  generatePassword({
    length = 20,
    charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=',
  }) {
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    return password;
  }
}
