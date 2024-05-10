//import { EventEmitter } from 'events';
import EventEmitter from 'eventemitter2';
import Base from '../../base.js';

// We wrap event emmiter for various future reasons. This will get more elaborate over time.
export default class Event extends Base {
  constructor(args) {
    super({ table: 'event', ...args });

    this.EventEmitter = new EventEmitter({
      wildcard: true,
      delimiter: '.',
      ignoreErrors: true,
    });
  }

  on(...args) {
    return this.EventEmitter.on(...args);
  }

  emit(...args) {
    return this.EventEmitter.emit(...args);
  }
}
