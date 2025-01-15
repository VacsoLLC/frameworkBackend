import Base from '../base.js';

export default class Menu extends Base {
  constructor(args) {
    super({className: 'menu', ...args});
    this.methodAdd({id: 'getAllMenuItems', method: this.getAllMenuItems});
  }

  async extractMenuItems(req, res) {
    const menuItems = {};

    for (const dbName of Object.keys(this.packages)) {
      for (const tableName of Object.keys(this.packages[dbName])) {
        const classInstance = this.packages[dbName][tableName];
        const menuItem = classInstance.getMenuItems();

        for (const item of menuItem) {
          if (
            item.roles &&
            (await req.user.userHasAnyRoleName(...item.roles)) == false
          ) {
            continue;
          }

          if (
            item.rolesHide.length > 0 &&
            (await req.user.userHasAnyRoleName(...item.rolesHide)) == true
          ) {
            continue;
          }

          let outputitem = {...item};
          if (item.filter && typeof item.filter == 'function') {
            outputitem.filter = item.filter(req);
          }
          if (item.parent === null) {
            if (!menuItems[item.label]) {
              menuItems[item.label] = {
                children: {},
                ...menuItems[item.label],
                ...outputitem,
              };
            } else {
              menuItems[item.label] = outputitem;
              menuItems[item.label].children = {};
            }
          } else {
            if (!menuItems[item.parent]) {
              menuItems[item.parent] = {
                label: item.parent,
                parent: null,
                view: null,
                children: {},
              };
            }
            menuItems[item.parent].children[item.label] = {
              ...menuItems[item.parent].children[item.label],
              ...outputitem,
            };
          }
        }
      }
    }

    return menuItems;
  }

  async getAllMenuItems(args) {
    return await this.extractMenuItems(args.req);
  }
}
