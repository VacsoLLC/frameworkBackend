import knex from 'knex';
import bcrypt from 'bcrypt';
import Base from './base.js';

let knexInstance = null;
const knexConnected = {};
//const knexInstances = {};

// Keys are our column types, values are the knex column types
const columnTypeConversion = {
  string: 'string',
  password: 'string',
  integer: 'integer',
  datetime: 'bigint',
  text: 'text',
  boolean: 'boolean',
};

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
    this.actions = [];
    this.addRecords = []; // used to add records after the table is created, if they dont already exist. These can be records in other tables
    this.insertQueueForThisTable = []; // records to add to this table after initialization. Other tables can add records to this queue via thier addRecord method.
    this.initFunctions = []; // functions to run after the table is created
    this.queryModifier = {}; // used to modify queries before they are run

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
      helpText: 'Close Record',
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
    });

    this.actionAdd({
      newLine: true,
    });

    this.readOnlyMethodsAdd({
      recordGet: true,
      rowsGet: true,
      schemaGet: true,
    });
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

  async columnAdd({
    columnName, // The ID of the column in the code
    actualColumnName = null, // the actual column name in the table, used for joins
    table = this.table, // the table this column is from
    db = this.db, // the database this column is from // TODO actually use this value
    tableAlias = this.table,

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
  }) {
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

    if (this.columns[columnName]) {
      console.error(`Column ${columnName} already exists!`);
      return;
    }

    if (!friendlyName) {
      friendlyName = columnName;
    }

    if (!actualColumnName) {
      actualColumnName = columnName;
    }

    this.columns[columnName] = {
      friendlyName,
      friendlyColumnName,
      columnType,
      dbColumnType,
      index,
      helpText,
      table,
      tableAlias,
      db,
      display,
      join,
      joinDb,
      actualColumnName,
      primaryKey,
      order,
      hidden,
      hiddenList,
      hiddenRecord,
      hiddenCreate,
      hiddenUpdate,
      defaultValue,
      fieldWidth,
      fieldType,
      onCreate,
      onUpdate,
      onCreateOrUpdate,
      listStyle,
      options,
      readOnly,
      referenceCreate,
      queryModifier,
    };
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
    if (!action.hasOwnProperty('showSuccess')) {
      action.showSuccess = true; // Set 'showSuccess' to true if it doesn't exist
    }
    action.id = this.actions.length;
    this.actions.push(action);
  }

  async columnExists(columnName) {
    //await knexInstance.raw(`use ${this.db}`); // TODO: This is a workaround for knex's mysql imlpementation hasColumn doesnt' respect the withSchema
    return await this.knex.schema
      //.withSchema(this.db)
      .hasColumn(this.dbDotTable, columnName);
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
  }) {
    let selectedColumns = [];
    let query = this.knex.from(this.dbDotTable);

    for (const columnName in this.columns) {
      if (columns.length > 0 && !columns.includes(columnName)) {
        continue;
      }

      if (this.columns[columnName].columnType == 'password') {
        // never ever ever read passwords
        continue;
      }

      const column = this.columns[columnName];

      selectedColumns.push(
        `${column.tableAlias}.${column.actualColumnName} as ${columnName}`
      );

      if (column.join) {
        query = query.leftJoin(
          `${column.joinDb}.${column.join} as ${columnName}`,
          `${this.table}.${columnName}`,
          //`${column.join} as ${columnName}`,
          //`${this.table}.${columnName}`,
          '=',
          `${columnName}.id`
        );
      }
    }

    query = query.select(selectedColumns);

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

    if (queryModifier && this.queryModifier[queryModifier]) {
      query = this.queryModifier[queryModifier](query, this.knex);
    }

    let count = null;
    if (returnCount) {
      const countQuery = query.clone().count('* as count');
      const result = await this.queryRun(countQuery);
      count = result[0].count;
    }

    query = query.orderBy(sortField, sortOrder);
    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    const rows = await this.queryRun(query);
    return {
      rows,
      count,
    };
  }

  async schemaGet({ req: { user } }) {
    let schema = { ...this.columns };
    for (const columnName in this.columns) {
      const column = this.columns[columnName];

      if (column.defaultValue && typeof column.defaultValue == 'function') {
        schema[columnName].defaultValue = column.defaultValue({ user });
      }
    }
    return {
      name: this.name,
      schema,
    };
  }

  async actionsGet() {
    return this.actions;
  }

  async childrenGet() {
    return this.children;
  }

  async recordCreate({ data = {}, audit = true, req }) {
    for (const columnName in this.columns) {
      const column = this.columns[columnName];

      if (column.onCreate && typeof column.onCreate == 'function') {
        data[columnName] = column.onCreate(data[columnName]);
      }

      if (column.columnType == 'password' && data[columnName]) {
        data[columnName] = await this.hashPassword(data[columnName]);
      }
    }

    for (const callback of this.onCreate) {
      data = await callback.call(this, data, req);
    }

    await this.emit('recordCreate.before', {
      data,
      req,
    });

    try {
      const query = this.knex.from(this.dbDotTable).insert(data); //.returning('id');
      const [recordId] = await this.queryRun(query);
      console.log(`Record created with ID ${recordId} in ${this.table}`);

      data.id = recordId;

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
        data,
        req,
      });

      return { id: recordId };
    } catch (err) {
      console.error(`Error creating record in ${this.table}: ${err}`);
      throw err;
    }
  }

  async recordUpdate({ recordId, data, req }) {
    for (const columnName in this.columns) {
      if (!data.hasOwnProperty(columnName)) {
        continue;
      }

      const columnSettings = this.columns[columnName];

      if (columnSettings.columnType == 'password' && data && data[columnName]) {
        data[columnName] = await this.hashPassword(data[columnName]);
      }

      if (
        columnSettings.onUpdate &&
        typeof columnSettings.onUpdate == 'function'
      ) {
        data[columnName] = columnSettings.onUpdate(data[columnName]);
      }
    }

    for (const callback of this.onUpdate) {
      data = await callback.call(this, data, req);
    }

    await this.emit('recordUpdate.before', {
      recordId,
      data,
      req,
    });

    const query = this.knex
      .from(this.dbDotTable)
      .where('id', recordId)
      .update(data);
    const result = await this.queryRun(query);

    for (const columnName in this.columns) {
      const column = this.columns[columnName];
      if (column.columnType == 'password' && data[columnName]) {
        // never expose passwords
        delete data[columnName];
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
      data,
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
  async recordGet({ recordId, where, returnPasswords = false }) {
    if (!recordId && !where) {
      throw new Error('recordId or where is required to fetch a record.');
    }

    try {
      if (!where) {
        where = { id: recordId };
      }

      let selectedColumns = [];

      for (const columnName in this.columns) {
        if (
          this.columns[columnName].columnType == 'password' &&
          !returnPasswords
        ) {
          // never ever ever read passwords
          continue;
        }

        if (this.columns[columnName].table != this.table) {
          continue;
        }
        selectedColumns.push(columnName);
      }

      let query = this.knex
        .from(this.dbDotTable)
        .select(selectedColumns)
        .where(where)
        .first();

      // Run the query
      const result = await this.queryRun(query);
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
}
