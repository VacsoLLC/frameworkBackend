import { EventEmitter } from 'events';
import Base from '../../base.js';

// We wrap event emmiter for various future reasons. This will get more elaborate over time.
export default class Event extends Base {
  constructor(args) {
    super({ table: 'event', ...args });

    this.EventEmitter = new EventEmitter();
  }

  on(...args) {
    this.EventEmitter.on(...args);
  }

  emit(...args) {
    this.EventEmitter.emit(...args);
  }
}
