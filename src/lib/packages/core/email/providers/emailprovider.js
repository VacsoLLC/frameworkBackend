export default class EmailProvider {
  constructor({ config, callBack, dbs, noBackgroundTasks }) {
    this.config = config;
    this.callBack = callBack;
    this.packages = dbs;
    this.noBackgroundTasks = noBackgroundTasks;
  }

  async init() {
    return true;
  }

  async sendEmail() {
    throw new Error('Not implemented');
  }
}
