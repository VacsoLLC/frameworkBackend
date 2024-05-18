export default class EmailProvider {
  constructor({ config, callBack, dbs }) {
    this.config = config;
    this.callBack = callBack;
    this.packages = dbs;
  }

  async init() {
    return true;
  }

  async sendEmail() {
    throw new Error('Not implemented');
  }
}
