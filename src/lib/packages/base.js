// All framework classes must extend base. It provides a common interface.
export default class Base {
  constructor({ className, packageName, packages, config, options = {} }) {
    this.className = className;
    this.packageName = packageName;
    this.packages = packages;
    this.config = config;
    this.options = options;
    this.requiredRoles = []; // Roles required to execute methods in this class. The user must have ANY of these roles. This is role names and not IDs. If blank any authenticated user can execute.
    this.requiredReadRoles = []; // Roles required to execute methods that are flagged as read only. The user must have ANY of these roles. This is role names and not IDs. This is only used if the RequiredRoles is not blank.
    this.menuItems = [];
    this.readOnlyMethods = {}; // Methods that are read only. The user must have any of the requiredReadRoles to execute these methods.
    this.authenticationRequired = true; // If false, the user does not need to be authenticated to access this class.
  }

  // This is called after all packages and classes have been initialized.
  // Overload it to do any async setup and/or interact with other objects.
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

  // Always call this after addRequiredRole to ensure that the menu item is automatically filtered for the roles that shouldn't see it.
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
      table: this.className,
      db: this.packageName,
      order,
      icon,
      roles: requiredRoles,
    });
  }

  async authorized({ req, action }) {
    if (this.requiredRoles.length == 0) {
      // No roles required. Anyone can access this class.
      return true;
    }

    if (
      (await req.user.userHasAnyRoleName(...this.requiredReadRoles)) &&
      this.readOnlyMethods[action]
    ) {
      // user has read only role and this method is a read only method
      return true;
    }

    // If the user has any of the required roles
    if (await req.user.userHasAnyRoleName(...this.requiredRoles)) {
      return true;
    }

    return false;
  }
}
