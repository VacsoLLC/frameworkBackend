// this class is used by tables and non tables to provide a common interface for the backend to interact with classes

export default class Base {
  constructor({ name, table, db, dbs, config, options = {} }) {
    this.name = name || table;
    this.table = table;
    this.db = db;
    this.dbDotTable = `${db}.${table}`;
    this.dbs = dbs;
    this.config = config;
    this.options = options;
    this.requiredRoles = []; // Roles required to read or write to this table. The user must have ANY of these roles. This is role names and not IDs. If blank anyone can read and write.
    this.requiredReadRoles = []; // Roles required to read this table. The user must have ANY of these roles. This is role names and not IDs. This is only used if the RequiredRoles is not blank.
    this.menuItems = [];
  }

  // This is called after all objects have been initialized. Overload it to do any async setup and/or interact with other objects.
  async init() {
    return;
  }

  getMenuItems() {
    return this.menuItems;
  }

  // Always call this before addMenuItem to ensure that the role is required to access the menu item.
  // Allows read and write access to the table.
  addRequiredRoles(...role) {
    if (role.length == 0) {
      throw new Error('Role is required to add a required role.');
    }

    this.requiredRoles.push(...role);
  }

  // Allows read only access to the table.
  addRequiredReadRoles(...role) {
    if (role.length == 0) {
      throw new Error('Role is required to add a required role.');
    }

    this.requiredReadRoles.push(...role);
  }

  // Always call this after addREquiredRole to ensure that the menu item is automatically filtered for the roles that shouldn't see it.
  async addMenuItem({
    label,
    parent = null,
    view = 'default',
    filter = () => ({}),
    order = 500, // Order to put this item in the menu. The default value is 500. Admin menu is 1000.
    icon = null,
    roles = [], // The user must have any one of these roles to see this menu item. If blank anyone can see it.
  }) {
    if (!label) {
      throw new Error('Label is required for the menu item.');
    }

    const requiredRoles = [...this.requiredRoles, ...roles];

    this.menuItems.push({
      label,
      parent,
      view,
      filter,
      table: this.table,
      db: this.db,
      order,
      icon,
      roles: requiredRoles,
    });
  }

  async authorized({ req, action }) {
    if (this.requiredRoles.length == 0) {
      // No roles required. Anyone can access this table.
      return true;
    }

    if (
      (await req.user.userHasAnyRoleName(...this.requiredReadRoles)) &&
      this.readOnlyActions[action]
    ) {
      // user has read only role and this action is a read only action
      return true;
    }

    // If the user has any of the required roles
    if (await req.user.userHasAnyRoleName(...this.requiredRoles)) {
      return true;
    }

    return false;
  }
}
