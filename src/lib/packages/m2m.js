import Table from './table.js';

export default class m2m extends Table {
  constructor(args) {
    super({
      packageName: args.m2m.db,
      className: args.m2m.table,
      db: args.m2m.db, // clean up/remove this
      table: args.m2m.table, // clean up/remove this
      name: args.m2m.friendlyName,
      ...args,
    });

    const m2m = args.m2m;

    this.addManyToOne({
      columnName: 'id1',
      columnType: 'integer',
      referencedTableName: m2m.table1.table,
      displayColumns: [
        {
          columnName: m2m.table1.columnName,
          friendlyName: m2m.table1.friendlyName,
        },
      ],
      index: true,
      tabName: m2m.friendlyName,
    });

    this.addManyToOne({
      columnName: 'id2',
      columnType: 'integer',
      referencedTableName: m2m.table2.table,
      displayColumns: [
        {
          columnName: m2m.table2.columnName,
          friendlyName: m2m.table2.friendlyName,
        },
      ],
      index: true,
      tabName: m2m.friendlyName,
    });
  }
}
