// Keys are our column types, values are the knex column types
const columnTypeConversion = {
  string: 'string',
  password: 'string',
  integer: 'integer',
  datetime: 'bigint',
  text: 'text',
  boolean: 'boolean',
};

export default class Column {
  /**
   * Creates an instance of a Column.
   * 
   * @param {Object} params - The parameters for the column.
   * @param {Object} params.thisTable - The table object this column is from.
   * @param {string} params.columnName - The ID of the column in the code.
   * @param {string} [params.actualColumnName=null] - The actual column name in the table, used for joins.
   * @param {Object} [params.table] - The table this column is from.
   * @param {Object} [params.db] - The database this column is from.
   * @param {string} [params.tableAlias=null] - The alias of the table this column is from.
   * @param {string} [params.columnType='string'] - The column type (string, integer, etc.).
   * @param {string} [params.fieldType] - The field type in the GUI, defaults to the value of columnType.
   * @param {number} [params.fieldWidth=50] - The width of the field.
   * @param {boolean} [params.index=false] - Whether to index this column.
   * @param {boolean} [params.join=false] - If this is a foreign key, what table does it join to?
   * @param {boolean} [params.joinDb=false] - If this is a foreign key, what db does it join to?
   * @param {boolean} [params.referenceCreate=false] - If true, shows a create button next to the reference field.
   * @param {Function} [params.queryModifier=false] - Can be used to modify the query for references before it is run.
   * @param {boolean} [params.display=true] - Whether to display this in the GUI.
   * @param {string} [params.friendlyName] - The display name of the column in the GUI.
   * @param {string} [params.friendlyColumnName=params.actualColumnName] - The ID to use to display friendly names from the joined table.
   * @param {string} [params.helpText=''] - Help text for the column to be displayed in the GUI.
   * @param {boolean} [params.primaryKey=false] - Whether this is a primary key.
   * @param {number} [params.order=10000] - The order of the column in the table.
   * @param {boolean} [params.hidden=false] - Whether to always hide this column.
   * @param {boolean} [params.hiddenList=false] - Whether to hide this column in the list view.
   * @param {boolean} [params.hiddenRecord=false] - Whether to hide this column on create or update.
   * @param {boolean} [params.hiddenCreate=false] - Whether to hide this column on create.
   * @param {boolean} [params.hiddenUpdate=false] - Whether to hide this column on update.
   * @param {*} [params.defaultValue] - The default value of the column.
   * @param {boolean} [params.onCreate=false] - Whether to execute on create.
   * @param {boolean} [params.onUpdate=false] - Whether to execute on update.
   * @param {boolean} [params.onCreateOrUpdate=false] - Whether to execute on create or update.
   * @param {string} [params.listStyle=null] - The style of the list.
   * @param {boolean} [params.readOnly=false] - Whether the field is read-only and cannot be modified in the GUI.
   * @param {Array} [params.options=[]] - The options for the column.
   * @param {Array} [params.rolesRead=null] - Users must have one of these roles to read this column.
   * @param {Array} [params.rolesWrite=null] - Users must have one of these roles to write to this column.
   * @param {Array} [params.rolesCreate=null] - Users must have one of these roles to create this column.
   * @param {boolean} [params.required=false] - Whether the field is required.
   * @param {Array<Function>} [params.validations=[]] - Array of functions to validate the field.
   * @param {boolean} [params.unique=false] - Whether the field must be unique.
   * 
   * @throws {Error} If both onCreateOrUpdate and onCreate or onUpdate are set.
   */
  constructor({
    thisTable, // the table object this column is from
    columnName, // The ID of the column in the code
    actualColumnName = null, // the actual column name in the table, used for joins
    table, //= this.table, // the table this column is from
    db, //= this.db, // the database this column is from // TODO actually use this value
    tableAlias = null, // the alias of the table this column is from
    columnType = 'string', // The column type (string, integer, etc.)
    fieldType, // defaults to the value of columnType, can be overriden to change the field type in the GUI
    fieldWidth = 50,
    index = false, // index this column?

    // Reference fields
    join = false, // if this is a foreign key, what table does it join to?
    joinDb = false, // if this is a foreign key, what db does it join to?
    referenceCreate = false, // If true, shows a create button next to the reference field
    queryModifier = false, // Can be used to modify the query for references before it is run. Useful for filtering in fancy ways.

    display = true, // display this in the gui
    friendlyName, // The display of the column in the GUI
    friendlyColumnName = actualColumnName, // The ID to use to display friendly names from the joined table
    helpText = '', // help text for the column to be displayed in the GUI
    primaryKey = false, // is this a primaryKey?
    order = 10000, // the order of the column in the table. The default value is 10,000. The primaryKey defaults to 5000.

    hidden = false, // hide awlays
    hiddenList = false,
    hiddenRecord = false, // hide on create or update
    hiddenCreate = false,
    hiddenUpdate = false,
    defaultValue,
    onCreate = false,
    onUpdate = false,
    onCreateOrUpdate = false,
    listStyle = null,

    readOnly = false, // Field is read only and can not be modified in the gui

    options = [],

    rolesRead = null, // Users must have one of these roles to read this column. If blank, the table level permissions apply
    rolesWrite = null, // Users must have one of these roles to write to this column. If blank, the table level permissions apply
    rolesCreate = null, // Users must have one of these roles to create this column. If blank, the table level permissions apply. writers can always create.

    required = false, // Field is required
    validations = [], // Array of functions to validate the field
    unique = false, // Field must be unique
  }) {
    if (!tableAlias) tableAlias = thisTable.table;

    if (rolesWrite === null) {
      rolesWrite = thisTable.rolesWrite;
    } else {
      thisTable.rolesWriteAllAdd(...rolesWrite); // If the role isn't already in the master list of roles that can write, add it.
    }

    if (rolesRead === null) {
      rolesRead = thisTable.rolesRead;
    } else {
      thisTable.rolesReadAllAdd(...rolesRead); // If the role isn't already in the master list of roles that can read, add it.
    }

    if (rolesCreate === null) {
      rolesCreate = thisTable.rolesWrite;
    } else {
      thisTable.rolesWriteAllAdd(...rolesCreate); // If the role isn't already in the master list of roles that can write, add it.
    }

    let dbColumnType = columnTypeConversion[columnType];

    if (!fieldType) {
      fieldType = columnType;
    }

    if (onCreateOrUpdate && (onCreate || onUpdate)) {
      throw new Error(
        `Cannot have onCreateOrUpdate and onCreate or onUpdate at the same time.`
      );
    }

    if (onCreateOrUpdate) {
      onCreate = onCreateOrUpdate;
      onUpdate = onCreateOrUpdate;
    }

    if (!dbColumnType) {
      console.error(
        `Unknown column type '${columnType}'. Defaulting to string.`
      );
      dbColumnType = columnTypeConversion['string'];
      columnType = 'string';
    }

    if (!friendlyName) {
      friendlyName = columnName;
    }

    if (!actualColumnName) {
      actualColumnName = columnName;
    }

    this.columnName = columnName;
    this.friendlyName = friendlyName;
    this.friendlyColumnName = friendlyColumnName;
    this.columnType = columnType;
    this.dbColumnType = dbColumnType;
    this.index = index;
    this.helpText = helpText;
    this.table = table || thisTable.table;
    this.tableAlias = tableAlias;
    this.db = db || thisTable.db;
    this.display = display;
    this.join = join;
    this.joinDb = joinDb;
    this.actualColumnName = actualColumnName;
    this.primaryKey = primaryKey;
    this.order = order;
    this.hidden = hidden;
    this.hiddenList = hiddenList;
    this.hiddenRecord = hiddenRecord;
    this.hiddenCreate = hiddenCreate;
    this.hiddenUpdate = hiddenUpdate;
    this.defaultValue = defaultValue;
    this.fieldWidth = fieldWidth;
    this.fieldType = fieldType;
    this.onCreate = onCreate;
    this.onUpdate = onUpdate;
    this.onCreateOrUpdate = onCreateOrUpdate;
    this.listStyle = listStyle;
    this.options = options;
    this.readOnly = readOnly;
    this.referenceCreate = referenceCreate;
    this.queryModifier = queryModifier;
    this.rolesRead = rolesRead;
    this.rolesWrite = rolesWrite;
    this.rolesCreate = rolesCreate;
    this.required = required;
    this.validations = validations;
    this.unique = unique;
  }

  async getDefaultValue({ req }) {
    if (this.defaultValue && typeof this.defaultValue === 'function') {
      return await this.defaultValue({ req });
    } else if (this.defaultValue) {
      return this.defaultValue;
    }
  }

  async hasReadAccess({ req }) {
    if (req.securityId == 1) return true; // System user can always read
    if (!req || !req.user || !req.user.userHasAnyRoleName) return true; // System request, no auth required
    if (this.rolesWrite.length == 0) return true; // No write roles, anyone can read
    if (await req.user.userHasAnyRoleName(...this.rolesWrite)) return true; // User has write access
    if (await req.user.userHasAnyRoleName(...this.rolesRead)) return true; // User has read access
    return false; // User has no matching roles
  }

  async hasWriteAccess({ req }) {
    if (req.securityId == 1) return true; // System user can always write
    if (!req || !req.user || !req.user.userHasAnyRoleName) return true; // System request, no auth required
    if (this.rolesWrite.length == 0) return true; // No write roles, anyone can write
    if (await req.user.userHasAnyRoleName(...this.rolesWrite)) return true; // User has write access
    return false; // User does not have write access
  }

  async hasCreateAccess({ req }) {
    if (req.securityId == 1) return true; // System user can always create
    if (!req || !req.user || !req.user.userHasAnyRoleName) return true; // System request, no auth required
    if (this.rolesWrite.length == 0) return true; // No write roles, anyone can create
    if (await req.user.userHasAnyRoleName(...this.rolesWrite)) return true; // User has write access
    if (this.rolesCreate && this.rolesCreate.length > 0) {
      return await req.user.userHasAnyRoleName(...this.rolesCreate); // Check specific create roles
    }
    return false; // User does not have create access
  }

  async getAccess({ req }) {
    return {
      hasReadAccess: await this.hasReadAccess({ req }),
      hasWriteAccess: await this.hasWriteAccess({ req }),
      hasCreateAccess: await this.hasCreateAccess({ req }),
    };
  }

  async validate({ value, req }) {
    const errors = [];
    if (this.required && !value) {
      errors.push(`Field ${this.friendlyName} is required.`);
    }
    if (this.validations && this.validations.length > 0) {
      for (const validate of this.validations) {
        const result = await validate.call(this.thisTable, {
          value,
          req,
        });
        if (result) {
          errors.push(result);
        }
      }
    }
    return errors;
  }
}
