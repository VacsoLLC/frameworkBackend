import Table from '../../table.js';

export default class Group extends Table {
  constructor(args) {
    super({ name: 'Group', table: 'group', ...args });

    this.addRequiredRoles('Admin');
    this.addRequiredReadRoles('Authenticated');

    this.addColumn({
      columnName: 'name',
      friendlyName: 'Name',
      columnType: 'string',
      index: true,
      helpText: 'Group Name',
    });

    this.addManyToMany({
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
