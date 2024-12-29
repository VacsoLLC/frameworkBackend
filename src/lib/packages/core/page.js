import Table from '../table.js';

export default class Page extends Table {
  constructor(args) {
    super({name: 'Page', className: 'page', viewRecord: 'page', ...args});

    this.columnAdd({
      columnName: 'title',
      friendlyName: 'Title',
      columnType: 'string',
    });

    this.manyToOneAdd({
      columnName: 'parent',
      referencedDb: 'core',
      referencedTableName: 'page',
      displayColumns: [
        {
          columnName: 'title',
          friendlyName: 'Parent',
        },
      ],
      tabName: 'Child pages',
      tabOrder: 1,
    });

    this.columnAdd({
      columnName: 'body',
      friendlyName: 'Body',
      columnType: 'text',
      fieldType: 'html',
    });

    this.childAdd({
      db: 'core', // db name we want to make a child
      table: 'attachment', // table name we want to make a child
      columnmap: {
        // key is the column name in the child table, value is from the parent table. Only db, table and id are availible options at this time from the parent
        db: 'db',
        table: 'table',
        row: 'id',
      },
      tabName: 'Attachments',
      tabOrder: 99997,
    });

    this.actionAdd({
      label: 'Attach File(s)',
      type: 'attach',
    });

    this.addMenuItem({
      label: 'Pages',
      parent: 'Admin',
      icon: 'NotebookText',
      navigate: '/core/page',
      order: 99,
      view: 'pages',
    });
  }
}
