import knex from 'knex';
import bcrypt from 'bcrypt';
import Base from './base.js';

import Column from './column.js';
import Action from './action.js';

let knexInstance = null;
const knexConnected = {};
//const knexInstances = {};

// This is the main class for creating tables. It extends the base class.
// For database based classes:
// the package maps to a database
// the class maps to a table
// the methods map to actions on that table or a row in that table

export default class Table extends Base {
  constructor(...args) {
    super(...args);

    this.knex = null;
    this.columns = {};
    this.parents = [];
    this.children = [];
    this.manyToMany = [];
    this.onCreate = [];
    this.onUpdate = [];
    this.actions = {};
    this.addRecords = []; // used to add records after the table is created, if they dont already exist. These can be records in other tables
    this.insertQueueForThisTable = []; // records to add to this table after initialization. Other tables can add records to this queue via thier addRecord method.
    this.initFunctions = []; // functions to run after the table is created
    this.queryModifier = {}; // used to modify queries before they are run
    this.accessFilters = []; // used to filter records based on user access
    this.rolesDelete = []; // Default roles required to delete records in this class. The user must have ANY of these roles. This is role names and not IDs. If blank any authenticated user that can write can also delete.

    this.name = args[0].name; // Display table name. Displayed at the top of forms and tables.
    this.db = this.packageName;
    this.table = this.className;
    this.dbDotTable = `${this.packageName}.${this.className}`;

    // TODO: finish buttons: colors, success message (true/false, default true), fix delete, make sure create button works still

    this.actionAdd({
      label: 'Update',
      method: 'recordUpdate',
      helpText: 'Update the record and stay here',
    });

    this.actionAdd({
      label: 'Update & Close',
      method: 'recordUpdate',
      helpText: 'Update the record and close',
      close: true,
    });

    this.actionAdd({
      label: 'Close',
      method: this.noOp,
      helpText: 'Close Page, go to previous page.',
      close: true,
      color: 'secondary',
      showSuccess: false,
    });

    this.actionAdd({
      label: 'Delete',
      helpText: 'Delete Record',
      method: 'recordDelete',
      verify:
        'Are you sure you want to delete this record? This action cannot be undone.',
      close: true,
      color: 'danger',
      rolesExecute: this.rolesDelete,
    });

    this.actionAdd({
      newLine: true,
      method: this.noOp, // FIXME: this is a workaround to the method registration process. fix this.
    });

    this.readOnlyMethodsAdd({
      recordGet: true,
      rowsGet: true,
      schemaGet: true,
      actionsGet: true,
      childrenGet: true,
    });

    this.methodAdd('recordGet', this.recordGet);
    this.methodAdd('recordCreate', this.recordCreate);
    this.methodAdd('recordUpdate', this.recordUpdate);
    this.methodAdd('recordDelete', this.recordDelete);
    this.methodAdd('rowsGet', this.rowsGet);
    this.methodAdd('schemaGet', this.schemaGet);
    this.methodAdd('actionsGet', this.actionsGet);
    this.methodAdd('childrenGet', this.childrenGet);
  }

  rolesDeleteAdd(...role) {
    this.rolesDelete = this.combineArrays(this.rolesDelete, role);
  }

  queryModifierAdd(name, callback) {
    this.queryModifier[name] = callback;
  }

  async readOnlyMethodsAdd(methods) {
    this.readOnlyMethods = { ...this.readOnlyMethods, ...methods };
  }

  async init(packages) {
    console.log(`Initializing DB: ${this.db} Table: ${this.table}`);

    this.knex = await this.getKnexInstance(this.db);

    // Every table is a child of the audit table.
    this.childAdd({
      db: 'core', // db name we want to make a child
      table: 'audit', // table name we want to make a child
      columnmap: {
        // key is the column name in the child table, value is from the parent table. Only db, table and id are availible options at this time from the parent
        db: 'db',
        table: 'table',
        row: 'id',
      },
      tabName: 'Audit',
    });

    await this.initializeTable();
    await this.registerChildWithParents(packages);
    await this.runInitFunctions();
  }

  async runInitFunctions() {
    for (const func of this.initFunctions) {
      await func();
    }
  }

  async getKnexInstance(packangeName) {
    if (!knexInstance) {
      knexInstance = knex(this.config.db[packangeName]);
    }

    knexConnected[packangeName] = true;

    return knexInstance;
  }

  async initializeTable() {
    let tableCreated = false;

    const exists = await this.knex.schema
      .withSchema(this.db)
      .hasTable(`${this.table}`);
    if (!exists) {
      try {
        await this.knex.schema.createTable(this.dbDotTable, (table) => {
          table.increments('id').primary();
        });
        console.log(`Table ${this.db}.${this.table} created!`);
        tableCreated = true;
      } catch (error) {
        console.error(`Error creating table ${this.table}: ${error}`);
      }
    }

    this.columnAdd({
      friendlyName: 'ID',
      columnName: 'id',
      columnType: 'integer',
      help: 'The unique identifier of the record',
      primaryKey: true,
      order: 5000, // Force ID field to the start of the table. The default value is 10,000.
      ...this.options.id,
    });

    // create columns if nessary
    for (const columnName in this.columns) {
      const column = this.columns[columnName];
      if (
        (this.table == column.table || column.join) &&
        !(await this.columnExists(columnName))
      ) {
        try {
          await this.knex.schema
            .withSchema(this.db)
            .table(this.table, (table) => {
              table[column.dbColumnType](columnName).comment(column.helpText);
              if (column.index) {
                table.index(columnName);
              }
            });
          console.log(`Column ${columnName} added to ${this.table}!`);
        } catch (err) {
          console.error(`Error adding column ${columnName}: ${err}`);
        }
      }
    }

    // create default records, if nessary
    if (tableCreated) {
      for (const record of this.insertQueueForThisTable) {
        let recordToCreate = { ...record };
        delete recordToCreate.className;
        delete recordToCreate.packageName;
        for (const columnName in recordToCreate) {
          // if value is a function, run the function
          if (typeof recordToCreate[columnName] == 'function') {
            recordToCreate[columnName] = recordToCreate[columnName]();
          }
        }
        await this.recordCreate({
          data: recordToCreate,
          req: {
            user: {
              id: '0',
            },
            action: 'Table initialization',
          },
        });
        console.log('Default record added', record);
      }
    }
  }

  async registerChildWithParents(databases) {
    for (const parent of this.parents) {
      const parentTable = databases[parent.db][parent.table];
      await parentTable.childAdd({
        db: this.db,
        table: this.table,
        //column: parent.column,
        columnmap: {
          [parent.column]: 'id',
        },
        tabName: parent.tabName,
      });
    }
  }

  async childAdd(args) {
    this.children.push(args);
  }

  async columnAdd(args) {
    if (this.columns[args.columnName]) {
      console.error(`Column ${args.columnName} already exists!`);
      return;
    }

    args.table = args.table || this.table;
    args.db = args.db || this.table;
    args.thisTable = this;

    const column = new Column(args);

    this.columns[column.columnName] = column;
  }

  async manyToManyAdd(args) {
    this.manyToMany.push(args);
  }

  async manyToOneAdd({
    referencedTableName,
    referencedDb = this.db,
    referenceCreate = false, // If true, shows a create button next to the reference field
    columnName = null,
    displayColumns = [],
    tabName = this.table,
    defaultValue,
    hiddenCreate,
    queryModifier = false, // Can be used to modify the query for references before it is run. Useful for filtering in fancy ways.
    ...args
  }) {
    columnName = columnName || `${referencedTableName}_id`;

    for (const columnData of displayColumns) {
      await this.columnAdd({
        columnType: 'string', // Assuming 'string' as a default type for display columns
        table: referencedTableName,
        tableAlias: columnName,
        db: referencedDb,
        ...columnData,
        columnName: `${columnName}_${columnData.columnName}`,
        actualColumnName: columnData.columnName,
        rolesRead: args.rolesRead,
        rolesWrite: args.rolesWrite,
      });
    }

    await this.columnAdd({
      columnName,
      columnType: 'integer',
      display: false,
      join: referencedTableName,
      joinDb: referencedDb,
      friendlyName: displayColumns[0].friendlyName,
      friendlyColumnName: displayColumns[0].columnName,
      defaultValue,
      hiddenCreate,
      referenceCreate,
      queryModifier,
      ...args,
    });

    this.parents.push({
      table: referencedTableName,
      db: referencedDb,
      column: columnName,
      tabName,
    });
  }

  onCreateAdd(callback) {
    this.onCreate.push(callback);
  }

  onUpdateAdd(callback) {
    this.onUpdate.push(callback);
  }

  onCreateOrUpdateAdd(callback) {
    this.onCreate.push(callback);
    this.onUpdate.push(callback);
  }

  actionAdd(action) {
    const id = 'action' + (action.id || action?.label?.replace(/\s+/g, ''));

    if (this.actions[id]) {
      throw new Error(
        `Duplicate action key: ${id}. Each method must have a unqiue label (after spaces have been removed) or id field.`
      );
    }

    const newAction = new Action({ ...action, id, thisTable: this });

    this.actions[id] = newAction;
  }

  async actionValidate({ req, id, args }) {
    if (!this.actions[id]) {
      throw new Error(`Invalid method or action. ID: ${id}`);
    }

    if (!this.actions[id].inputs) return; // If there are no inputs, there is nothing to validate

    const errors = [];

    for (const input in this.actions[id].inputs) {
      if (this.actions[id].inputs[input].required && !args[input]) {
        errors.push(`The ${input} field is required.`);
      }
      if (
        this.actions[id].inputs[input].validations &&
        Array.isArray(this.actions[id].inputs[input].validations)
      ) {
        for (const validate of this.actions[id].inputs[input].validations) {
          const result = validate.call(this, { req, id, args });
          if (result) {
            errors.push(result);
          }
        }
      }
    }

    if (errors.length > 0) {
      return errors;
    } else {
      return;
    }
  }

  async columnExists(columnName) {
    //await knexInstance.raw(`use ${this.db}`); // TODO: This is a workaround for knex's mysql imlpementation hasColumn doesnt' respect the withSchema
    return await this.knex.schema
      //.withSchema(this.db)
      .hasColumn(this.dbDotTable, columnName);
  }

  selectJoin({ query }) {
    for (const columnName in this.columns) {
      const column = this.columns[columnName];

      if (column.join) {
        query = query.leftJoin(
          `${column.joinDb}.${column.join} as ${columnName}`,
          `${this.table}.${columnName}`,
          '=',
          `${columnName}.id`
        );
      }
    }
    return query;
  }

  selectColumns({
    columns = [],
    returnPasswords = false,
    includeJoins = true,
    user,
    query,
  }) {
    let selectedColumns = [];

    for (const columnName in this.columns) {
      if (columns.length > 0 && !columns.includes(columnName)) {
        continue;
      }

      const column = this.columns[columnName];

      // Check if the user has permission to read this column
      if (user && column.rolesRead && column.rolesRead.length > 0) {
        if (!user.userHasAnyRoleName(...column.rolesRead)) {
          continue; // Skip this column if user doesn't have permission
        }
      }

      if (column.columnType == 'password' && !returnPasswords) {
        continue;
      }

      if (includeJoins == false && column.table != this.table) {
        continue;
      }

      selectedColumns.push(
        `${column.tableAlias}.${column.actualColumnName} as ${columnName}`
      );
    }

    query.select(selectedColumns);

    return query;
  }

  async rowsGet({
    where,
    sortField = 'id',
    sortOrder = 'desc',
    limit,
    offset,
    returnCount = false,
    columns = [],
    queryModifier = false,
    queryModifierArgs = {},
    req,
  }) {
    let query = this.knex.from(this.dbDotTable);

    // Apply access filters
    for (const accessFilter of this.accessFilters) {
      [query] = await accessFilter(req?.user, query); // if you pass just the query variable, the knex promise gets resolved and the query gets executed early. why? I dont know.
    }

    // apply where clauses
    if (Array.isArray(where)) {
      for (const whereClause of where) {
        if (Array.isArray(whereClause)) {
          query = query.where(...whereClause);
        } else {
          query = query.where(whereClause);
        }
      }
    } else if (where) {
      query = query.where(where);
    }

    // code based filters
    if (queryModifier && this.queryModifier[queryModifier]) {
      query = this.queryModifier[queryModifier](
        query,
        this.knex,
        queryModifierArgs
      );
    }

    query = this.selectJoin({ query });

    let count = null;

    if (returnCount) {
      // get count of rows, if requested
      const countQuery = query.clone().count('* as count');

      const result = await this.queryRun(countQuery);
      count = result[0].count;
    }

    // get columns and joins to select
    query = this.selectColumns({ columns, user: req?.user, query });

    // apply sorting, limits, and offsets
    query = query.orderBy(sortField, sortOrder);
    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    const rows = await this.queryRun(query);

    return {
      rows,
      count,
    };
  }

  async schemaGet({ req }) {
    let schema = {};

    for (const columnName in this.columns) {
      const column = this.columns[columnName];

      const temp = { ...column };

      const { hasReadAccess, hasWriteAccess, hasCreateAccess } =
        await column.getAccess({
          req,
        });

      // skip this column if user has no access
      if (!hasReadAccess && !hasWriteAccess) continue;

      if (hasReadAccess && !hasWriteAccess) {
        temp.readOnly = true;
      }

      temp.createAllowed = hasCreateAccess;

      const defaultValue = await column.getDefaultValue({ req });
      if (defaultValue) {
        temp.defaultValue = defaultValue;
      }

      schema[columnName] = temp;
    }

    const readOnly = !(await req.user.userHasAnyRoleName(
      ...this.rolesAllWrite
    ));

    return {
      name: this.name,
      readOnly,
      schema,
    };
  }

  async actionsGet({ id, req }) {
    let filteredActions = {};

    const record = await this.recordGet({ recordId: id, req });

    for (const [key, action] of Object.entries(this.actions)) {
      if (!(await action.haveAccess(req))) {
        continue;
      }

      const newAction = { ...action.toJSON() };

      newAction.disabled = await action.disabledCheck(this, record, req);

      filteredActions[key] = newAction;
    }

    return filteredActions;
  }

  async childrenGet({ req }) {
    const children = [];
    for (const child of this.children) {
      if (
        await this.packages[child.db][child.table].authorized({
          req,
          action: 'rowsGet',
        })
      ) {
        children.push(child);
      } else {
        continue;
      }
    }

    return children;
  }

  // Helper method to check if a user can write to a column
  userCanWriteColumn(user, columnName) {
    const column = this.columns[columnName];
    return (
      !column.rolesWrite ||
      column.rolesWrite.length === 0 ||
      user.userHasAnyRoleName(...column.rolesWrite)
    );
  }

  async recordCreate({ data, audit = true, req }) {
    let filteredData = {};

    const errors = [];

    for (const columnName in this.columns) {
      const column = this.columns[columnName];

      // Check write permission
      const { hasCreateAccess } = await column.getAccess({
        req,
      });

      if (hasCreateAccess && data.hasOwnProperty(columnName)) {
        // if the user has permission to write to the column, use the value they provided
        filteredData[columnName] = data[columnName];
      }

      // if the column was not supplied by the user, but there is a default value, use that.
      if (!filteredData[columnName]) {
        const temp = await column.getDefaultValue({ req });
        if (temp) {
          filteredData[columnName] = temp;
        }
      }

      // Run the onCreate function for this column
      if (column.onCreate && typeof column.onCreate == 'function') {
        filteredData[columnName] = column.onCreate(filteredData[columnName]);
      }

      if (column.columnType == 'password' && filteredData[columnName]) {
        filteredData[columnName] = await this.hashPassword(
          filteredData[columnName]
        );
      }

      if (column.required && !filteredData[columnName]) {
        errors.push(`Field ${column.friendlyName} is required.`);
      }

      if (column.validations && column.validations.length > 0) {
        for (const validate of column.validations) {
          const result = validate.call(this, {
            columnName,
            args: filteredData,
            req,
          });
          if (result) {
            errors.push(result);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    for (const callback of this.onCreate) {
      filteredData = await callback.call(this, filteredData, req);
    }

    await this.emit('recordCreate.before', {
      data: filteredData,
      req,
    });

    try {
      const query = this.knex.from(this.dbDotTable).insert(filteredData); //.returning('id');
      const [recordId] = await this.queryRun(query);
      console.log(`Record created with ID ${recordId} in ${this.table}`);

      filteredData.id = recordId;

      if (audit) {
        await this.audit({
          message: 'Record Created',
          args: arguments,
          recordId,
          req,
        });
      }

      await this.emit('recordCreate.after', {
        recordId,
        data: filteredData,
        req,
      });

      return { id: recordId };
    } catch (err) {
      console.error(`Error creating record in ${this.table}: ${err}`);
      throw err;
    }
  }

  async recordUpdate({ recordId, data, req }) {
    const newData = {};

    for (const columnName in data) {
      const columnSettings = this.columns[columnName];

      if (!columnSettings) {
        console.log('WARNING! Column not found:', columnName);
        continue;
      }

      if (columnSettings.table != this.table) {
        continue;
      }

      if (!data.hasOwnProperty(columnName)) {
        continue;
      }

      // Check write permission
      const { hasWriteAccess } = await columnSettings.getAccess({
        req,
      });

      if (!hasWriteAccess) {
        console.log('User does not have write access to column:', columnName);
        continue; // Skip this column if user doesn't have permission
      }

      if (columnSettings.columnType == 'password' && data && data[columnName]) {
        newData[columnName] = await this.hashPassword(data[columnName]);
        continue;
      }

      if (
        columnSettings.onUpdate &&
        typeof columnSettings.onUpdate == 'function'
      ) {
        data[columnName] = columnSettings.onUpdate(data[columnName]);
      }

      newData[columnName] = data[columnName];
    }

    for (const callback of this.onUpdate) {
      data = await callback.call(this, data, req);
    }

    await this.emit('recordUpdate.before', {
      recordId,
      newData,
      req,
    });

    const query = this.knex
      .from(this.dbDotTable)
      .where('id', recordId)
      .update(newData);
    const result = await this.queryRun(query);

    for (const columnName in this.columns) {
      const column = this.columns[columnName];
      if (column.columnType == 'password' && data[columnName]) {
        // never expose passwords
        delete newData[columnName];
      }
    }

    await this.audit({
      message: 'Record Updated',
      args: arguments,
      recordId,
      req,
    });

    await this.emit('recordUpdate.after', {
      recordId,
      newData,
      req,
    });

    return { rowsUpdated: result };
  }

  async emit(event, args) {
    args.table = this.table;
    args.db = this.db;
    await this.packages.core.event.emit(
      `${this.db}.${this.table}.${event}`,
      args
    );
  }

  async recordDelete({ recordId, req }) {
    await this.emit('recordDelete.before', {
      recordId,
      req,
    });

    const query = this.knex
      .from(this.dbDotTable)
      .where('id', recordId)
      .delete();
    const result = await this.queryRun(query);

    await this.audit({
      message: 'Record Delete',
      args: arguments,
      recordId,
      req,
    });

    await this.emit('recordDelete.after', {
      recordId,
      req,
    });

    return { rowsDeleted: result };
  }

  // returns a single record. If multiple records are found, only the first is returned.
  async recordGet({ recordId, where, returnPasswords = false, req }) {
    if (!recordId && !where) {
      throw new Error('recordId or where is required to fetch a record.');
    }

    try {
      if (!where) {
        where = { [`${this.dbDotTable}.id`]: recordId };
      }

      // prepare the query
      let query = this.knex.from(this.dbDotTable).where(where).first();

      // Get columns to select
      query = this.selectColumns({
        returnPasswords,
        includeJoins: true,
        user: req?.user,
        query,
      });

      // Get joins
      query = this.selectJoin({ query });

      // add any access filters
      for (const accessFilter of this.accessFilters) {
        [query] = await accessFilter(req?.user, query);
      }

      // Run the query
      const result = await this.queryRun(query);

      // if not found, will return null... should we throw? probably not.
      //if (!result) {
      //  throw new Error('Record not found');
      //}

      return result;
    } catch (err) {
      console.error(`Error fetching record from ${this.table}: ${err}`);
      throw err;
    }
  }

  async queryRun(queryBuilder) {
    // Print the SQL it is about to run
    // TODO add timeout. Maybe up at the router?

    const start = Date.now();

    const sql = queryBuilder.toString();
    const result = await queryBuilder;

    const time = Date.now() - start;

    const debug = true; // TODO: implement debug flag

    if (debug) {
      console.log(`Query took ${time} ms ${sql}`);
    }

    return result;
  }

  async audit({ args, message, recordId, req }) {
    if (!req || !req.user || !req.user.id) {
      throw new Error(
        'A request object with a user object is required for auditing. Include the request object when calling the function.'
      );
    }

    if (!recordId) {
      throw new Error(
        'A recordId is required for auditing. Include recordId when calling function.'
      );
    }

    let data = { ...args[0] };

    // Hide some data we dont want to audit ever.
    if (data.req) {
      delete data.req;
    }

    await this.packages.core.audit.log({
      message,
      db: this.db,
      table: this.table,
      row: recordId,
      detail: JSON.stringify(data, null, 4),
      //user: req.user.id,
      req,
    });
  }

  async hashPassword(password) {
    const saltRounds = 10; // 10 is a good balance of security and performance
    try {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      // Store hashedPassword in your database
      console.log('Hashed password:', hashedPassword);
      return hashedPassword;
    } catch (error) {
      console.error('Error hashing password:', error);
    }
  }

  // Add a record to a table at table creation time
  // This is useful for adding default records to a table
  // Can also be used to add records to other tables by speicifying the db and table
  async addRecord(record) {
    if (!record.packageName) {
      record.packageName = this.packageName;
    }

    if (!record.className) {
      record.className = this.className;
    }

    this.addRecords.push(record);
    // TODO finish implementing this.
  }

  initAdd(record) {
    this.initFunctions.push(record);
  }

  async addAccessFilter(filter) {
    this.accessFilters.push(filter);
  }
}
