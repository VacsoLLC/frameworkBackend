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



    for (const provider of Object.values(this.mailboxes)) {
      await provider.init();
    }
    return;
  }

  async sendEmail({ email, provider = this.config.email.defaultMailbox }) {
    const results = await this.mailboxes[provider].sendEmail(email);

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
