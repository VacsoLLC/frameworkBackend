import Table from '../table.js';
import {z} from 'zod';

export default class Page extends Table {
  constructor(args) {
    super({name: 'Page', className: 'page', viewRecord: 'page', ...args});

    this.clearCache(); // init the cache

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
      tabHide: true,
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
      validator: z.object({}),
    });

    this.addMenuItem({
      label: 'Pages',
      parent: 'Admin',
      icon: 'NotebookText',
      navigate: '/core/page',
      order: 99,
      view: 'pages',
      roles: ['admin'],
    });

    this.methodAdd({
      id: 'pagesGet',
      method: this.pagesGet,
      validator: z.object({
        parentId: z.number().nullable(),
      }),
    });

    this.onUpdateAdd((data, req) => {
      if (data.id == data.parent) {
        throw new Error('Page cannot be its own parent');
      }
      return data;
    });
  }

  async rowsGet(args) {
    // don't return bodies, as the user may not have permissions
    const newArgs = args;
    newArgs.columns = ['id', 'title', 'parent'];
    return await super.rowsGet(newArgs);
  }

  async pagesGet({req, parentId}) {
    // Make sure we are authorized to view the parent page
    if (!this.authorized({req, id: parentId})) {
      return [];
    }

    // return a list of pages, and the number of children that page has.
    const query = this.knex('core.page')
      .select(
        'core.page.id',
        'core.page.title',
        this.knex.raw('count(child.id) as children'), // determine if the page has children
        this.knex.raw('count(core.pagepermision.id) as permissions'), // Optimization, if the page has no permissions, we can skip checking them
      )
      .leftJoin('core.page as child', function () {
        this.on('child.parent', 'core.page.id').andOnNull('child.deleted_at');
      })
      .leftJoin('core.pagepermision', function () {
        this.on('core.page.id', 'core.pagepermision.page').andOnNull(
          'core.pagepermision.deleted_at',
        );
      })
      .where('core.page.parent', parentId)

      .groupBy('core.page.id');

    const result = await query;

    const returnValue = [];
    // If the child page has permissions, check them. If not, return the page.
    for (const page of result) {
      if (
        page.permissions == 0 ||
        (await this.authorized({req, id: page.id}))
      ) {
        returnValue.push(page);
      }
    }

    return returnValue;
  }

  // This is a method that is called when a user tries to access a page
  // we are overriding the base method
  async authorized({req, id}) {
    if (id || req.params.recordId) {
      const page = id || req.params.recordId;
      const user = req.user.id;

      if (this.hasCache(user, page)) {
        console.log('Page access: Cache hit: ', this.getCache(user, page));
        return this.getCache(user, page);
      }

      const query = this.knex.raw(
        `
WITH RECURSIVE page_hierarchy AS (
    SELECT 
        id,
        parent,
        0 as level
    FROM core.page
    WHERE id = ?
    UNION ALL
    SELECT 
        w.id,
        w.parent,
        ph.level + 1
    FROM core.page w
    INNER JOIN page_hierarchy ph ON w.id = ph.parent
    WHERE w.deleted_at IS NULL
),
hierarchy_with_perms AS (
    SELECT 
        ph.id,
        parent,
        level,
        count(pp.id) as permcount
    FROM page_hierarchy ph
    left outer join core.pagepermision pp on 
        pp.page=ph.id
    WHERE pp.deleted_at IS NULL
    group by ph.id, parent, level    
    
    ORDER BY level asc
)
SELECT pp.* 
FROM core.pagepermision pp
JOIN (
    SELECT id FROM hierarchy_with_perms 
    WHERE permcount > 0 
    LIMIT 1
) t ON pp.page = t.id`,
        [page],
      );

      const result = await query;

      // No permissions, everyone gets full access
      if (result[0].length == 0) {
        this.setCache(user, page, 'RW');
        console.log('Page access: ', 'No Perms, full access');
        return true;
      }

      const perms = {};
      for (const row of result[0]) {
        if (row.role && req.user.roles.includes(row.role)) {
          perms[row.access] = true;
        }
        if (row.user && row.user == user) {
          perms[row.access] = true;
        }
        if (row.group && req.user.groups.includes(row.group)) {
          perms[row.access] = true;
        }
      }

      if (!perms['Read'] && !perms['Read/Write']) {
        console.log('Page access: ', 'None');
        this.setCache(user, page, false);
        return false;
      }

      console.log('Page access: ', perms['Read/Write'] ? 'Read/Write' : 'Read');
      if (perms['Read/Write']) {
        this.setCache(user, page, 'RW');
        return 'RW';
      }

      this.setCache(user, page, 'R');

      return 'R';
    }

    return true;
  }

  hasCache(user, page) {
    if (
      this.permissionCache.userPage[user] &&
      this.permissionCache.userPage[user].hasOwnProperty(page)
    ) {
      return true;
    }
  }

  getCache(user, page) {
    return this.permissionCache.userPage?.[user]?.[page];
  }

  setCache(user, page, value) {
    if (!this.permissionCache.userPage[user]) {
      this.permissionCache.userPage[user] = {};
    }
    this.permissionCache.userPage[user][page] = value;
  }

  clearCache() {
    this.permissionCache = {
      page: {},
      userPage: {},
    };
  }
}
