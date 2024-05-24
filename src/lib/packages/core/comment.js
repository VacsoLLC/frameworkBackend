import Table from '../table.js';

export default class Comment extends Table {
  constructor(args) {
    super({
      name: 'Comment',
      className: 'comment',
      ...args,
      options: {
        id: {
          hiddenList: true,
        },
      },
    });

    this.columnAdd({
      columnName: 'created',
      friendlyName: 'Created',
      columnType: 'datetime',
      hiddenCreate: true,
      readOnly: true,
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
    });

    this.columnAdd({
      columnName: 'table',
      friendlyName: 'Table',
      columnType: 'string',
      hiddenList: true,
      hiddenUpdate: true,
    });

    this.columnAdd({
      columnName: 'row',
      friendlyName: 'Row',
      columnType: 'integer',
      hiddenList: true,
      hiddenUpdate: true,
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
      tabName: 'Comments',
      defaultValue: ({ user }) => {
        return user.id;
      },
    });

    this.columnAdd({
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

    this.columnAdd({
      columnName: 'body',
      friendlyName: 'Comment',
      columnType: 'text',
      index: true,
      helpText: 'Comment',
      fieldType: 'textArea',
    });
  }

  async createComment({ req, db, table, recordId, comment, type = 'Private' }) {
    return await this.recordCreate({
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
