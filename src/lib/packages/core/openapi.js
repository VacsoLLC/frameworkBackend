import Base from '../base.js';
import {z} from 'zod';

import {generateOpenAPI} from '../../registry.js';

export default class OpenApi extends Base {
  constructor(args) {
    super({className: 'openapi', ...args});
    this.authenticationRequired = false;

    this.methodAdd({id: 'list', method: this.list, validator: z.any()});
  }

  async list({req}) {
    req.res.send(generateOpenAPI(this.config.general.baseURL));
    return;
  }
}
