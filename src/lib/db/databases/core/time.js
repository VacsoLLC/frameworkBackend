import Table from '../../table.js';

export default class Time extends Table {
  constructor(args) {
    super({
      name: 'Time',
      table: 'time',
      ...args,
      optoins: {
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
      defaultValue: ({ user }) => {
        return user.id;
      },
    });

    this.addColumn({
      columnName: 'seconds',
      friendlyName: 'Seconds',
      columnType: 'integer',
    });

    this.addColumn({
      columnName: 'time',
      friendlyName: 'Time',
      columnType: 'string',
      hiddenCreate: true,
      hiddenUpdate: true,
    });

    this.addOnCreateOrUpdate((fields) => {
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

  createEntry({ seconds, db, table, recordId, req }) {
    return this.recordCreate({
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
