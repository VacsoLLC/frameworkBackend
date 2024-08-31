import Table from '../table.js';

export default class Group extends Table {
  constructor(args) {
    super({ name: 'Group', className: 'group', ...args });

    this.rolesWriteAdd('Admin');

    this.columnAdd({
      columnName: 'name',
      friendlyName: 'Name',
      columnType: 'string',
      index: true,
      unique: true,
      helpText: 'Group Name',
      rolesRead: ['Authenticated'],
    });

    this.manyToManyAdd({
      table1: {
        db: 'core',
        table: 'group',
        columnName: 'name',
        friendlyName: 'Group',
      },
      table2: {
        db: 'core',
        table: 'user',
        columnName: 'name',
        friendlyName: 'User',
      },
      friendlyName: 'User Group',
      table: 'user_group',
      db: 'core',
    });

    this.addMenuItem({
      label: 'Groups',
      parent: 'Admin',
      icon: 'pi-users',
      order: 2,
    });
  }
}
