// All framework classes must extend base. It provides a common interface.
export default class Base {
  constructor({ className, packageName, packages, config, options = {} }) {
    this.className = className;
    this.packageName = packageName;
    this.packages = packages;
    this.config = config;
    this.options = options;
    this.rolesWrite = []; // Default roles required to execute methods in this class. The user must have ANY of these roles. This is role names and not IDs. If blank any authenticated user can execute.
    this.rolesRead = []; // Default roles required to execute methods that are flagged as read only. The user must have ANY of these roles. This is role names and not IDs. This is only used if the rolesWrite is not blank.
    this.rolesAllWrite = []; // This is a combination of all the roles that can possibly write to this class. This is used by the table class since a user can be given access to a single column.
    this.rolesAllRead = []; // This is a combination of all the roles that can possibly read from this class. This is used by the table class since a user can be given access to a single column.
    this.menuItems = [];
    this.readOnlyMethods = {}; // Methods that are read only. The user must have any of the rolesRead to execute these methods.
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
  rolesWriteAdd(...role) {
    this.rolesWrite = this.combineArrays(this.rolesWrite, role);
    this.rolesAllWrite = this.combineArrays(this.rolesAllWrite, role);
  }

  rolesWriteAllAdd(...role) {
    this.rolesAllWrite = this.combineArrays(this.rolesAllWrite, role);
  }

  // Allows read only access to the table.
  rolesReadAdd(...role) {
    this.rolesRead = this.combineArrays(this.rolesRead, role);
    this.rolesAllRead = this.combineArrays(this.rolesAllRead, role);
  }

  rolesReadAllAdd(...role) {
    this.rolesAllRead = this.combineArrays(this.rolesAllRead, role);
  }

  // Always call this after rolesWriteAdd to ensure that the menu item is automatically filtered for the roles that shouldn't see it.
  async addMenuItem(menuItem) {
    //const rolesWrite = [...this.rolesWrite, ...(menuItem.roles || [])];
    let menuRoles = [];

    if (menuItem.roles) {
      menuRoles = menuItem.roles;
    } else {
      menuRoles = this.combineArrays(
        menuRoles,
        this.rolesWrite,
        this.rolesRead
      );
    }

    const newMenuItem = {
      // Default Values
      label: 'No Label Provided',
      parent: null,
      view: 'default',
      filter: () => ({}),
      order: 500, // Order to put this item in the menu. The default value is 500. Admin menu is 1000.
      icon: null,
      rolesHide: [], // The user must NOT have any of these roles to see this menu item. If blank, everyone can see it.
      table: this.className,
      db: this.packageName,
      navigate: `/${this.packageName}/${this.className}`, ///${items[item].db}/${items[item].table}

      // User Provided Values
      ...menuItem,

      // Calculated Values
      roles: menuRoles,
    };

    this.menuItems.push(newMenuItem);
  }

  async authorized({ req, action }) {
    if (this.rolesAllWrite.length == 0) {
      // No roles required. Anyone can access this class.
      return true;
    }

    // If the user has any of the required roles
    if (await req.user.userHasAnyRoleName(...this.rolesAllWrite)) {
      return true;
    }

    // If they have a read role, and this is a read only method
    if (
      this.rolesRead.length > 0 &&
      (await req.user.userHasAnyRoleName(...this.rolesAllRead)) &&
      this.readOnlyMethods[action]
    ) {
      // user has read only role and this method is a read only method
      return true;
    }

    return false;
  }

  combineArrays(...arrays) {
    if (arrays.length === 0) return [];

    const firstArray = arrays[0];
    const otherArrays = arrays.slice(1);

    for (const array of otherArrays) {
      for (const item of array) {
        if (!firstArray.includes(item)) {
          firstArray.push(item);
        }
      }
    }

    return firstArray;
  }
}
