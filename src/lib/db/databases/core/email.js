import fs from 'fs';

import Base from '../../base.js';

import Handlebars from 'handlebars';
import EmailProviders from './email/providers/index.js';

import path from 'path';
import { fileURLToPath } from 'url';

export default class Email extends Base {
  constructor(args) {
    super({ table: 'email', ...args });

    this.mailboxes = {};

    for (const mailbox of this.config.email.mailboxes) {
      this.mailboxes[mailbox.name] = new EmailProviders[mailbox.type]({
        config: mailbox,
        callBack: this.processEmail.bind(this),
        dbs: this.dbs,
      });
    }
  }

  async init() {
    this.templates = {};

    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    this.templates.subject = await this.compileTemplate(
      //'src\\backend\\lib\\db\\databases\\core\\email\\templates\\subject.hbs'
      path.join(__dirname, 'email', 'templates', 'subject.hbs')
    );
    this.templates.body = await this.compileTemplate(
      //'src\\backend\\lib\\db\\databases\\core\\email\\templates\\body.hbs'
      path.join(__dirname, 'email', 'templates', 'body.hbs')
    );

    for (const provider of Object.values(this.mailboxes)) {
      await provider.init();
    }
    return;
  }

  async sendEmail(args, req) {
    const user = await this.dbs.core.user.getRecord({
      recordId: args.record.requester,
    });

    if (!user) {
      throw new Error('No user found! Can not send email');
    }

    const email = {};
    email.body = this.templates.body(args);
    email.subject = this.templates.subject(args);
    email.to = user.email;
    email.emailId = args.record.emailId;
    email.emailConversationId = args.record.emailConversationId;
    email.args = args;

    let provider = this.config.email.defaultMailbox;
    if (args.record.emailProvider) {
      provider = args.record.emailProvider;
    }

    const results = await this.mailboxes[provider].sendEmail(email, req);

    if (results && results.emailId && results.emailConversationId) {
      await this.dbs[args.db][args.table].updateRecord({
        recordId: args.recordId,
        data: {
          emailId: results.emailId,
          emailConversationId: results.emailConversationId,
        },
        req,
      });
    }

    return results;
  }

  async processEmail(email) {
    console.log('email', email);
    try {
      this.dbs.core.event.emit('email', email);

      return true;
    } catch (error) {
      console.error('error processing email', error);
      return false;
    }
  }

  async compileTemplate(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, source) => {
        if (err) reject(err);
        else resolve(Handlebars.compile(source));
      });
    });
  }
}
