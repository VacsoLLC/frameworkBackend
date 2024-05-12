export default class Menu {
  constructor(router, db) {
    this.router = router;
    this.db = db;

    router.all('/menu/getMenuItems', this.getMenuItems.bind(this));
  }

  async extractMenuItems(req, res) {
    const menuItems = {};

    for (const dbName of Object.keys(this.db.databases)) {
      for (const tableName of Object.keys(this.db.databases[dbName])) {
        const table = this.db.databases[dbName][tableName];
        const menuItem = table.getMenuItems();

        for (const item of menuItem) {
          if (
            item.roles &&
            (await req.user.userHasAnyRoleName(...item.roles)) == false
          ) {
            continue;
          }

          let outputitem = { ...item };
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

  async getMenuItems(req, res) {
    return res
      .status(200)
      .json({ data: await this.extractMenuItems(req, res) });
  }
}
