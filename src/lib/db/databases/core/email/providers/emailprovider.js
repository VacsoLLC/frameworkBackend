export default class EmailProvider {
  constructor({ config, callBack, dbs }) {
    this.config = config;
    this.callBack = callBack;
    this.dbs = dbs;
  }

  async init() {
    return true;
  }

  async sendEmail() {
    throw new Error('Not implemented');
  }
}
