import Table from '../table.js';

export default class DeptTable extends Table {
  constructor(args) {
    super({ name: 'Department', className: 'dept', ...args });

    this.addRequiredRoles('Admin');

    this.columnAdd({
      columnName: 'name',
      friendlyName: 'Name',
      columnType: 'string',
      index: true,
      helpText: 'Department Name',
    });

    this.addMenuItem({
      label: 'Departments',
      parent: 'Admin',
      icon: 'pi-building',
    });
  }
}
