import humanizeDuration from 'humanize-duration';
import Table from '../table.js';
import { systemRequest } from '../../../util.js';
import path from 'path'
import { fileURLToPath } from 'url';


const ACCEPTED_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];

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
      columnName: 'author',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'Viewer',
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

    this.columnAdd({
      columnName: 'created_at',
      friendlyName: 'Created At',
      columnType: 'datetime',
      helpText: 'Creation Date',
      onCreate: () => {
        return Date.now();
      },
    });

    this.columnAdd({
      columnName: 'updated_at',
      friendlyName: 'Updated At',
      columnType: 'datetime',
      helpText: 'Update Date',
    });

    this.methodAdd('signUpInviteCreate', this.signUpInviteCreate, null, false, false);
  }

  async signUpInviteCreate({email, fromUser, req}) {
    const {baseURL} = this.config.forgotPassword;
    const {isEnabled, expiryInHours} = this.config.signUp;

    if (!isEnabled) {
        throw new Error('Sign up is disabled');
    }
    
    if(ACCEPTED_DOMAINS.filter(domain => email.includes(domain)).length === 0) {
        throw new Error('Invalid email')
    }

    try {
      const user = await this.packages.core.user.recordGet({where: {email}});
      if (user) {
        throw new Error('Email already exists');
      }
      // generate token
      const token = crypto.randomUUID();
      const expiry = new Date().getTime() + expiryInHours * 60 * 60 * 1000
      const __dirname = path.dirname(fileURLToPath(import.meta.url));

      // create invite
      const invite = await this.recordCreate({
        data: {
          email,
          token,
          expires: expiry,
          used: false,
        },
        req: fromUser ? req : systemRequest(this)
      });
      if (!invite) {
        throw new Error('Invite not created');
      }
      const emailBodyTemplate = await this.packages.core.email.compileTemplate(
        path.join(__dirname, 'user', 'signUpLinkEmailBody.hbs'),
      );
      const emailContent = {
        body: emailBodyTemplate({
          signUpLink: `${baseURL ?? 'https://localhost:5173'}/set-password?token=${token}`,
          expiryInHours
        }),
        subject: 'Link to create account',
        to: email,
      };
      await this.packages.core.email.sendEmail({
        email: emailContent,
        provider: this.config.email.defaultMailbox,
      });
      return {message: 'Sign up link is sent to email'}
    } catch (error) {
      throw new Error(error);
    }
  }
}
