import Table from '../table.js';

export default class Role extends Table {
  constructor(args) {
    super({name: 'Role', className: 'role', ...args});

    this.rolesWriteAdd('Admin');

    this.columnAdd({
      columnName: 'name',
      friendlyName: 'Name',
      columnType: 'string',
      index: true,
      helpText: 'Role Name',
    });

    this.columnAdd({
      columnName: 'desc',
      friendlyName: 'Description',
      columnType: 'string',
      helpText: 'Role Description',
    });

    this.manyToManyAdd({
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

    this.manyToManyAdd({
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
      icon: 'KeyRound',
      order: 1.5,
    });

    // this is a default record that will get added after the table is created
    this.addRecord({
      id: 1,
      name: 'Authenticated',
      desc: 'Any user that has successfully authenticated will have this role. This is a special role. Do not assign to users.',
    });

    this.addRecord({
      id: 2,
      name: 'Admin',
      desc: 'Admin users can add or remove users, groups and roles.',
    });

    this.nameToIDCache = {};
  }

  async roleNameToID(name) {
    if (this.nameToIDCache[name]) {
      return this.nameToIDCache[name];
    }

    const result = await this.recordGet({where: {name}, req: {}});

    this.nameToIDCache[name] = result.id;

    return result.id;
  }
}
