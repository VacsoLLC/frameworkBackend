import Base from '../base.js';
import {z} from 'zod';

export default class Healthcheck extends Base {
  constructor(args) {
    super({className: 'healthcheck', ...args});
    this.authenticationRequired = false;

    this.methodAdd({
      id: 'status',
      method: this.status,
      validator: z.object({}),
    });

    this.methodAdd({
      id: 'status2',
      method: this.status,
      validator: z.object({}),
    });
  }

  async status() {
    const recordId = 1;
    try {
      const user = await this.packages.core.user.recordGet({recordId, req: {}});

      if (!user) {
        throw new Error(
          `Test db call returned no record. Package: core Class: user RecordId: ${recordId}`,
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
