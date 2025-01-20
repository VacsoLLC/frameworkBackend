// All framework classes must extend base. It provides a common interface.
import {registry} from '../registry.js';
import {z} from 'zod';
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

const responseObject = z
  .object({
    success: z.boolean(),
    message: z.string(),
    data: z.object(),
  })
  .openapi('response');
export default class Base {
  constructor({
    className,
    packageName,
    packages,
    config,
    viewRecord = 'default',
    viewTable = 'default',
    options = {},
  }) {
    this.className = className;
    this.packageName = packageName;
    this.packages = packages;
    this.config = config;
    this.options = options;
    this.viewRecord = viewRecord;
    this.viewTable = viewTable; // Not used yet.
    this.rolesWrite = []; // Default roles required to execute methods in this class. The user must have ANY of these roles. This is role names and not IDs. If blank any authenticated user can execute.
    this.rolesRead = []; // Default roles required to execute methods that are flagged as read only. The user must have ANY of these roles. This is role names and not IDs. This is only used if the rolesWrite is not blank.
    this.rolesAllWrite = []; // This is a combination of all the roles that can possibly write to this class. This is used by the table class since a user can be given access to a single column.
    this.rolesAllRead = []; // This is a combination of all the roles that can possibly read from this class. This is used by the table class since a user can be given access to a single column.
    this.menuItems = [];
    this.readOnlyMethods = {}; // Methods that are read only. The user must have any of the rolesRead to execute these methods.
    this.authenticationRequired = true; // If false, the user does not need to be authenticated to access this class. This is a default. Methods can override this.
    this.methods = {}; // This is a list of all the methods in this class that are accessible via the API. use methodAdd to add a method.
    this.isTable = false;

    this.methodAdd({
      id: 'methodList',
      method: this.methodList,
      validator: z.object({}),
    });
  }

  // This is called after all packages and classes have been initialized.
  // Overload it to do any async setup and/or interact with other objects.
  async init() {
    return;
  }

  noOp() {
    return;
  }

  /**
   * Expose a method to the API.
   *
   * @param {Object} options - The options for adding the method.
   * @param {string} options.id - The unique identifier for the method.
   * @param {Function} options.method - The method function to be added.
   * @param {Object} [options.validator=null] - The validator object (must be a zod object).
   * @param {boolean} [options.overwrite=false] - Flag to allow overwriting an existing method.
   * @param {boolean} [options.authRequired=this.authenticationRequired] - Flag to indicate if authentication is required.
   *
   * @throws {Error} If the validator is not provided or does not have a parse method.
   * @throws {Error} If the method id is not provided.
   * @throws {Error} If the method is not provided or is not a function.
   * @throws {Error} If the method id already exists and overwrite is not set to true.
   */
  methodAdd({
    id,
    method,
    validator = null,
    overwrite = false,
    authRequired = this.authenticationRequired,
  }) {
    if (!validator || !validator.parse) {
      throw new Error('Validator is required. It must be a zod object.');
    }

    if (!id) {
      throw new Error('Method id is required.');
    }

    if (!method || typeof method !== 'function') {
      throw new Error('Method is required.');
    }

    if (this.methods[id] && overwrite === false) {
      throw new Error(
        `Method id ${id} was being overwritten. If you want to overwrite, set the overwrite flag to true.`,
      );
    }

    this.methods[id] = {
      method,
      authRequired,
      validator,
    };

    if (validator) {
      registry.registerPath({
        method: 'post',
        path: `/api/${this.packageName}/${this.className}/${id}`,
        summary: `${this.className}/${id}`,
        request: {
          body: {
            content: {
              'application/json': {
                schema: validator,
              },
            },
          },
        },
        responses: {
          200: {
            type: 'object',
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      description:
                        'The data returned from the function called.',
                    },
                    messages: {
                      type: 'array',
                      description:
                        'Array of objects that contain status messages.',
                    },
                    navigate: {
                      type: 'string',
                      description: 'Redirect to this path',
                    },
                  },
                },
              },
            },
          },
        },
      });
    }
  }

  methodAuthRequired({req, id}) {
    if (this.methods[id].authRequired === false) {
      return false;
    }

    return true;
  }

  async methodExecute(req, id, args) {
    if (!this.methods[id]) {
      return null;
    }

    if (!this.methods[id].validator || !this.methods[id].validator.parse) {
      throw new Error(
        'No validator found for this function. Cannot execute methods without a validator.',
      );
    }

    let parsedArgs = {};
    try {
      parsedArgs = this.methods[id].validator.parse(args);
    } catch (e) {
      throw new Error(e.errors.map((error) => error.message).join('. '));
    }

    try {
      return await this.methods[id].method.call(this, {...args, ...parsedArgs});
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      } else {
        throw new Error(e);
      }
    }
  }

  methodList(req, id, args) {
    return this.methods;
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
  /**
   * Adds a menu item to the menuItems array with the provided properties and default values.
   *
   * @param {Object} menuItem - The menu item to be added.
   * @param {string} [menuItem.label='No Label Provided'] - The label for the menu item.
   * @param {string|null} [menuItem.parent=null] - The parent menu item, if any.
   * @param {string} [menuItem.view='default'] - The view associated with the menu item.
   * @param {Function} [menuItem.filter=() => ({})] - The filter function for the menu item.
   * @param {number} [menuItem.order=500] - The order of the menu item in the menu.
   * @param {string|null} [menuItem.icon=null] - The icon for the menu item.
   * @param {Array<string>} [menuItem.rolesHide=[]] - Roles that should not see this menu item.
   * @param {string} [menuItem.table=this.className] - The table associated with the menu item.
   * @param {string} [menuItem.db=this.packageName] - The database associated with the menu item.
   * @param {string} [menuItem.navigate=`/${this.packageName}/${this.className}`] - The navigation path for the menu item.
   * @param {Array<string>} [menuItem.roles] - Roles that can see this menu item.
   */
  async addMenuItem(menuItem) {
    //const rolesWrite = [...this.rolesWrite, ...(menuItem.roles || [])];
    let menuRoles = [];

    if (menuItem.roles) {
      menuRoles = menuItem.roles;
    } else {
      menuRoles = this.combineArrays(
        menuRoles,
        this.rolesWrite,
        this.rolesRead,
      );
    }

    const newMenuItem = {
      // Default Values
      label: 'No Label Provided',
      parent: null,
      view: 'default',
      filter: () => {
        return [];
      },
      order: 500, // Order to put this item in the menu. The default value is 500. Admin menu is 1000.
      icon: null,
      rolesHide: [], // The user must NOT have any of these roles to see this menu item. If blank, everyone can see it.
      table: this.className,
      db: this.packageName,
      navigate: `/${this.packageName}/${this.className}`, ///${items[item].db}/${items[item].table}
      view: null,

      // User Provided Values
      ...menuItem,

      // Calculated Values
      roles: menuRoles,
    };

    this.menuItems.push(newMenuItem);
  }

  async authorized({req, action}) {
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
      this.rolesAllRead.length > 0 &&
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
