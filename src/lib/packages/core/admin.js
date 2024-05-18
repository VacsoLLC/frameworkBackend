// This just creates a menu item for the admin section.
import Base from '../base.js';
export default class Admin extends Base {
  constructor(args) {
    super({ className: 'admin', ...args });

    this.addRequiredRoles('Admin');

    this.addMenuItem({
      label: 'Admin',
      parent: null,
      view: null,
      order: 1000,
      icon: 'pi-lock',
    });
  }
}
