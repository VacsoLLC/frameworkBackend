import fs from 'fs';

import Base from '../base.js';

import Handlebars from 'handlebars';
import EmailProviders from './email/providers/index.js';

import path from 'path';
import {fileURLToPath} from 'url';

export default class Email extends Base {
  constructor(args) {
    super({className: 'email', ...args});

    this.mailboxes = {};

    if (
      !this.config.email ||
      !this.config.email.mailboxes ||
      Array.isArray(this.config.email.mailboxes) === false ||
      this.config.email.mailboxes.length === 0
    ) {
      console.log('No email configuration found');
      return;
    }

    for (const mailbox of this.config.email.mailboxes) {
      this.mailboxes[mailbox.name] = new EmailProviders[mailbox.type]({
        config: mailbox,
        callBack: this.processEmail.bind(this),
        noBackgroundTasks: this.config.noBackgroundTasks,
        dbs: this.packages,
      });
    }
  }

  async init() {
    this.templates = {};

    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    for (const provider of Object.values(this.mailboxes)) {
      await provider.init();
    }
    return;
  }

  async sendEmail({email, provider = this.config.email.defaultMailbox}) {
    if (!provider) {
      throw new Error(`No email provider provided`);
    }

    if (!this.mailboxes[provider]) {
      throw new Error(`Email provider ${provider} not found`);
    }

    const results = await this.mailboxes[provider].sendEmail(email);

    return results;
  }

  async processEmail(email) {
    console.log('email', email);
    try {
      this.packages.core.event.emit('email', email);

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
