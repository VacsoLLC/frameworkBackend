import Table from '../../table.js';

export default class Comment extends Table {
  constructor(args) {
    super({
      name: 'Comment',
      table: 'comment',
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
      readOnly: true,
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

    this.addColumn({
      columnName: 'type',
      friendlyName: 'Type',
      //columnType: 'string',
      index: true,
      helpText:
        'Public comments are visible to the customer or end user. Private comments are visible only to techs, agents, and admins.',
      defaultValue: 'Private',
      fieldType: 'select',
      options: ['Private', 'Public'],
    });

    this.addColumn({
      columnName: 'body',
      friendlyName: 'Comment',
      columnType: 'string',
      index: true,
      helpText: 'Comment',
      fieldType: 'textArea',
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
      tabName: 'Comments',
      defaultValue: ({ user }) => {
        return user.id;
      },
    });

    this.addOnCreate(async (args, req) => {
      // TODO every create and update should send a message to the event bus
      this.dbs.core.event.emit('comment', { ...args });

      return args;
    });
  }

  async createComment({ req, db, table, recordId, comment, type = 'Private' }) {
    return await this.createRecord({
      req,
      data: {
        db,
        table,
        row: recordId,
        body: comment,
        author: req.user.id,
        type,
      },
    });
  }
}
