import Base from '../base.js';

export default class Healthcheck extends Base {
  constructor(args) {
    super({ className: 'healthcheck', ...args });
    this.authenticationRequired = false;

    this.methodAdd('status', this.status);
  }

  async status() {
    const recordId = 1;
    try {
      const user = await this.packages.core.user.recordGet({ recordId });

      if (!user) {
        throw new Error(
          `Test db call returned no record. Package: core Class: user RecordId: ${recordId}`
        );
      }

      return {
        status: 'API is healthy',
        test_record: user,
      };
    } catch (error) {
      return {
        status: 'API failed',
        error: error.message,
      };
    }
  }
}
