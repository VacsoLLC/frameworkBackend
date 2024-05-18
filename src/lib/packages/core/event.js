//import { EventEmitter } from 'events';
import EventEmitter2 from 'eventemitter2';
import Base from '../base.js';

// We wrap event emmiter for various future reasons. This will get more elaborate over time.
export default class Event extends Base {
  constructor(args) {
    super({ className: 'event', ...args });

    this.EventEmitter = new EventEmitter2({
      wildcard: true,
      delimiter: '.',
      ignoreErrors: true,
    });
  }

  on(...args) {
    return this.EventEmitter.on(...args);
  }

  async emit(...args) {
    return await this.EventEmitter.emitAsync(...args);
  }
}
