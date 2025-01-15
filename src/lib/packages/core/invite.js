import humanizeDuration from 'humanize-duration';
import Table from '../table.js';
import {systemRequest} from '../../../util.js';
import path from 'path';
import {fileURLToPath} from 'url';

export default class Invite extends Table {
  constructor(args) {
    super({name: 'Invite', className: 'invite', ...args});

    this.columnAdd({
      columnName: 'email',
      friendlyName: 'Email',
      columnType: 'string',
      helpText: 'Email Address',
    });

    this.columnAdd({
      columnName: 'token',
      friendlyName: 'Token',
      columnType: 'string',
      index: true,
      unique: true,
      helpText: 'Token',
    });

    this.columnAdd({
      columnName: 'expires',
      friendlyName: 'Expires',
      columnType: 'datetime',
      helpText: 'Expiration Date',
    });

    this.columnAdd({
      columnName: 'used',
      friendlyName: 'Used',
      columnType: 'boolean',
      helpText: 'Has this token been used?',
    });

    this.manyToOneAdd({
      referencedTableName: 'user',
      columnName: 'Requested by',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'requested by',
          listStyle: 'nowrap',
          hiddenCreate: true,
        },
      ],
      hiddenCreate: true,
      tabName: 'Views',
      defaultValue: ({req}) => {
        return req.user.id;
      },
    });

    this.methodAdd({
      id: 'signUpInviteCreate',
      method: this.signUpInviteCreate,
    });
  }

  async signUpInviteCreate({email, fromUser, req}) {
    const {baseURL} = this.config.general;
    const {enabled, expiryInHours, allowedDomains} = this.config.signUp;

    if (!enabled) {
      throw new Error('Sign up is disabled');
    }

    if (
      allowedDomains.length > 0 &&
      allowedDomains.filter((domain) => email.includes(domain)).length === 0
    ) {
      throw new Error('Invalid email');
    }

    try {
      const user = await this.packages.core.user.recordGet({
        where: {email},
        req,
      });
      if (user) {
        throw new Error('Email already exists');
      }
      // generate token
      const token = crypto.randomUUID();
      const expiry = new Date().getTime() + expiryInHours * 60 * 60 * 1000;
      const __dirname = path.dirname(fileURLToPath(import.meta.url));

      // create invite
      const invite = await this.recordCreate({
        data: {
          email,
          token,
          expires: expiry,
          used: false,
        },
        req: fromUser ? req : systemRequest(this),
      });
      if (!invite) {
        throw new Error('Invite not created');
      }
      const emailBodyTemplate = await this.packages.core.email.compileTemplate(
        path.join(__dirname, 'invite', 'signUpLinkEmailBody.hbs'),
      );
      const emailContent = {
        body: emailBodyTemplate({
          signUpLink: `${baseURL ?? 'https://localhost:5173'}/set-password?token=${token}`,
          expiryInHours,
        }),
        subject: 'Email address validation & account creation',
        to: email,
      };
      await this.packages.core.email.sendEmail({
        email: emailContent,
        provider: this.config.email.defaultMailbox,
      });
      return {message: 'Sign up link is sent to email'};
    } catch (error) {
      throw new Error(error);
    }
  }
}
