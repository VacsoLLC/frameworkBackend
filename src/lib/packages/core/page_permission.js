import Table from '../table.js';

export default class PagePermission extends Table {
  constructor(args) {
    super({name: 'Page Permission', className: 'pagepermision', ...args});

    this.manyToOneAdd({
      referencedTableName: 'page',
      columnName: 'page',
      displayColumns: [
        {
          columnName: 'title',
          friendlyName: 'Page',
        },
      ],
      tabName: 'Page Permissions',
    });

    this.columnAdd({
      columnName: 'access',
      friendlyName: 'Access',
      columnType: 'select',
      options: ['Read', 'Read/Write'],
      defaultValue: 'Read',
    });

    this.manyToOneAdd({
      referencedTableName: 'role',
      columnName: 'role',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'Role',
        },
      ],
      tabName: 'Page Permissions',
    });

    this.manyToOneAdd({
      referencedTableName: 'user',
      columnName: 'user',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'User',
        },
      ],
      tabName: 'Page Permissions',
    });

    this.manyToOneAdd({
      referencedTableName: 'group',
      columnName: 'group',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'Group',
        },
      ],
      tabName: 'Page Permissions',
    });
  }
}
