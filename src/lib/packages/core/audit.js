import Table from '../table.js';
import { systemUser } from '../../../util.js';

export default class Audit extends Table {
  constructor(args) {
    super({
      name: 'Audit',
      className: 'audit',
      ...args,
      options: {
        id: {
          hiddenList: true,
        },
      },
    });

    // don't index this table
    this.index = false;

    this.rolesWriteAdd('Admin');

    this.columnAdd({
      columnName: 'created',
      friendlyName: 'Created',
      columnType: 'datetime',
      hiddenCreate: true,
      onCreate: () => {
        return Date.now();
      },
    });

    this.columnAdd({
      columnName: 'db',
      friendlyName: 'Database',
      columnType: 'string',
      hiddenList: true,
      hiddenUpdate: true,
      //hidden: true,
    });

    this.columnAdd({
      columnName: 'table',
      friendlyName: 'Table',
      columnType: 'string',
      hiddenList: true,
      hiddenUpdate: true,
      //hidden: true,
    });

    this.columnAdd({
      columnName: 'row',
      friendlyName: 'Row',
      columnType: 'integer',
      hiddenList: true,
      hiddenUpdate: true,
      //hidden: true,
    });

    this.manyToOneAdd({
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
      defaultValue: ({ req }) => {
        return req.user.id;
      },
    });

    this.columnAdd({
      columnName: 'action',
      friendlyName: 'Action',
      columnType: 'string',
      helpText: 'The action that was run.',
      fieldType: 'string',
    });

    this.columnAdd({
      columnName: 'message',
      friendlyName: 'Message',
      columnType: 'string',
      helpText: 'The human readable audit message.',
    });

    this.columnAdd({
      columnName: 'detail',
      friendlyName: 'Detail',
      columnType: 'text',
      helpText: 'Contains the JSON passed to the function.',
    });
  }

  async log(args) {
    await this.recordCreate({
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
      req: systemUser(this),
    });
  }
}
