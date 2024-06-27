import Base from '../base.js';
import { takeCoverage } from 'node:v8';

export default class Test extends Base {
  constructor(args) {
    super({ className: 'test', ...args });
    this.authenticationRequired = false;
  }

  async takeCoverage(req, res) {
    takeCoverage();
    return { stauts: 'OK' };
  }
}
