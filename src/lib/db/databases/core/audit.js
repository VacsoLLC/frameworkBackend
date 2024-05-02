import Table from '../../table.js';

export default class Audit extends Table {
  constructor(args) {
    super({
      name: 'Audit',
      table: 'audit',
      ...args,
      options: {
        id: {
          hiddenList: true,
        },
      },
    });

    this.addColumn({
      columnName: 'created',
      friendlyName: 'Created',
      columnType: 'datetime',
      hiddenCreate: true,
      onCreate: () => {
        return Date.now();
      },
    });

    this.addColumn({
      columnName: 'db',
      friendlyName: 'Database',
      columnType: 'string',
      hiddenList: true,
      hiddenUpdate: true,
      //hidden: true,
    });

    this.addColumn({
      columnName: 'table',
      friendlyName: 'Table',
      columnType: 'string',
      hiddenList: true,
      hiddenUpdate: true,
      //hidden: true,
    });

    this.addColumn({
      columnName: 'row',
      friendlyName: 'Row',
      columnType: 'integer',
      hiddenList: true,
      hiddenUpdate: true,
      //hidden: true,
    });

    this.addManyToOne({
      referencedTableName: 'user',
      columnName: 'user',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'Created By',
          listStyle: 'nowrap',
          hiddenCreate: true,
        },
      ],
      hiddenCreate: true,
      tabName: 'Audit Created By',
      defaultValue: ({ user }) => {
        console.log(user);
        return user.id;
      },
    });

    this.addColumn({
      columnName: 'action',
      friendlyName: 'Action',
      columnType: 'string',
      helpText: 'The action that was run.',
      fieldType: 'string',
    });

    this.addColumn({
      columnName: 'message',
      friendlyName: 'Message',
      columnType: 'string',
      helpText: 'The human readable audit message.',
      fieldType: 'textArea',
    });

    this.addColumn({
      columnName: 'detail',
      friendlyName: 'Detail',
      columnType: 'string',
      helpText: 'Contains the JSON passed to the function.',
      fieldType: 'textArea',
    });
  }

  async log(args) {
    await this.createRecord({
      data: {
        db: args.db,
        table: args.table,
        row: args.row,
        message: args.message,
        detail: args.detail,
        user: args.req.user.id || 0,
        created: args.req.date || Date.now(),
        action: args.req.action || 'Unknown',
      },
      audit: false,
    });
  }
}
