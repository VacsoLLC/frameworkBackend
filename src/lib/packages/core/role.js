import Table from '../table.js';

export default class Role extends Table {
  constructor(args) {
    super({ name: 'Role', className: 'role', ...args });

    this.addRequiredRoles('Admin');

    this.addColumn({
      columnName: 'name',
      friendlyName: 'Name',
      columnType: 'string',
      index: true,
      helpText: 'Role Name',
    });

    this.addManyToMany({
      table1: {
        db: 'core',
        table: 'role',
        columnName: 'name',
        friendlyName: 'Role',
      },
      table2: {
        db: 'core',
        table: 'user',
        columnName: 'name',
        friendlyName: 'User',
      },
      friendlyName: 'User Role',
      table: 'user_role',
      db: 'core',
    });

    this.addManyToMany({
      table1: {
        db: 'core',
        table: 'role',
        columnName: 'name',
        friendlyName: 'Role',
      },
      table2: {
        db: 'core',
        table: 'group',
        columnName: 'name',
        friendlyName: 'Group',
      },
      friendlyName: 'Group Role',
      table: 'group_role',
      db: 'core',
    });

    this.addMenuItem({
      label: 'Roles',
      parent: 'Admin',
      icon: 'pi-key',
      order: 1.5,
    });

    // this is a default record that will get added after the table is created
    this.addRecord({
      id: 1,
      name: 'Authenticated',
    }); //

    this.addRecord({
      id: 2,
      name: 'Admin',
    }); //

    this.nameToIDCache = {};
  }

  async roleNameToID(name) {
    if (this.nameToIDCache[name]) {
      return this.nameToIDCache[name];
    }

    const result = await this.recordGet({ where: { name } });

    this.nameToIDCache[name] = result.id;

    return result.id;
  }
}
