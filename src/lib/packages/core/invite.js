import humanizeDuration from 'humanize-duration';
import Table from '../table.js';
import {systemRequest} from '../../../util.js';
import path from 'path';
import {fileURLToPath} from 'url';
import {z} from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      hiddenList: true,
      hiddenCreate: true,
      readOnly: true,
    });

    this.columnAdd({
      columnName: 'expires',
      friendlyName: 'Expires',
      columnType: 'datetime',
      helpText: 'Expiration Date',
      hiddenCreate: true,
    });

    this.columnAdd({
      columnName: 'used',
      friendlyName: 'Used',
      columnType: 'boolean',
      helpText: 'Has this token been used?',
      hiddenCreate: true,
    });

    this.manyToOneAdd({
      referencedTableName: 'user',
      columnName: 'requestedby',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'Requested By',
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
      validator: z.object({
        email: z.string().email(),
        fromUser: z.boolean().optional(),
      }),
      authRequired: false,
    });

    this.addMenuItem({
      label: 'Invites',
      parent: 'Admin',
      icon: 'MailOpen',
      navigate: '/core/invite',
      order: 100,
      roles: ['admin'],
    });

    this.initAdd(async () => {
      this.packages.core.event.on(
        'core.invite.recordCreate.after',
        async ({data, req}) => {
          await this.inviteFromUI({recordId: data.id, email: data.email, req});
        },
      );
    });
  }

  async inviteFromUI({recordId, req, email}) {
    const {baseURL} = this.config.general;
    const {expiryInHours} = this.config.signUp;

    const token = crypto.randomUUID();
    const expiry = new Date().getTime() + expiryInHours * 60 * 60 * 1000;

    await this.recordUpdate({
      recordId,
      data: {
        email,
        token,
        expires: expiry,
        used: false,
      },
      req,
    });
    await this.sendEmail({token, email});
    return {message: 'A sign up invite has been sent.'};
  }

  async signUpInviteCreate({email, fromUser, req}) {
    const {enabled, allowedDomains} = this.config.signUp;

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
        await this._emailExists(email);
        return {message: 'A sign up invite has been sent.'};
      }
      // generate token
      const token = crypto.randomUUID();
      const expiry = new Date().getTime() + expiryInHours * 60 * 60 * 1000;

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

      await this.sendEmail({token, email});

      return {message: 'A sign up invite has been sent.'};
    } catch (error) {
      throw new Error(error);
    }
  }

  async sendEmail({token, email}) {
    const {baseURL} = this.config.general;
    const {expiryInHours} = this.config.signUp;

    const emailBodyTemplate = await this.packages.core.email.compileTemplate(
      path.join(__dirname, 'invite', 'signUpLinkEmailBody.hbs'),
    );

    const emailContent = {
      body: emailBodyTemplate({
        signUpLink: `${baseURL ?? 'https://localhost:5173'}/set-password?token=${token}`,
        expiryInHours,
      }),
      subject: 'New account creation',
      to: email,
    };

    await this.packages.core.email.sendEmail({
      email: emailContent,
      provider: this.config.email.defaultMailbox,
    });
  }

  async _emailExists(email) {
    const {baseURL} = this.config.general;

    const emailBodyTemplate = await this.packages.core.email.compileTemplate(
      path.join(__dirname, 'invite', 'emailAlreadyExists.hbs'),
    );

    const emailContent = {
      body: emailBodyTemplate({
        baseURL: `${baseURL ?? 'https://localhost:5173'}`,
      }),
      subject: 'New account creation',
      to: email,
    };

    await this.packages.core.email.sendEmail({
      email: emailContent,
      provider: this.config.email.defaultMailbox,
    });
  }
}
