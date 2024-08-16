import Table from '../table.js';

export default class Time extends Table {
  constructor(args) {
    super({
      name: 'Time',
      className: 'time',
      ...args,
      optoins: {
        id: {
          hiddenList: true,
        },
      },
    });

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
      columnName: 'author',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'Author',
          listStyle: 'nowrap',
          hiddenCreate: true,
        },
      ],
      hiddenCreate: true,
      tabName: 'Time',
      defaultValue: ({ req }) => {
        return req.user.id;
      },
    });

    this.columnAdd({
      columnName: 'seconds',
      friendlyName: 'Seconds',
      columnType: 'integer',
    });

    this.columnAdd({
      columnName: 'time',
      friendlyName: 'Time',
      columnType: 'string',
      hiddenCreate: true,
      hiddenUpdate: true,
    });

    this.onCreateOrUpdateAdd((fields) => {
      return {
        ...fields,
        time: this.formatTime(fields.seconds),
      };
    });
  }

  formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  async createEntry({ seconds, db, table, recordId, req }) {
    return await this.recordCreate({
      req,
      data: {
        db,
        table,
        row: recordId,
        seconds,
        author: req.user.id,
      },
    });
  }
}
