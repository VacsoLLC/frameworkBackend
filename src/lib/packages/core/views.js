import Table from '../table.js';
import {systemUser} from '../../../util.js';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {clouddebugger} from 'googleapis/build/src/apis/clouddebugger/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class Views extends Table {
  constructor(args) {
    super({
      name: 'Views',
      className: 'views',
      index: false,
      ...args,
      options: {
        id: {
          hiddenList: true,
        },
      },
    });
    // created at column - will not be used for any calculation
    this.columnAdd({
      columnName: 'created',
      friendlyName: 'Created',
      columnType: 'datetime',
      hiddenCreate: true,
      readOnly: true,
      onCreate: () => {
        return Date.now();
      },
    });

    this.columnAdd({
      columnName: 'start_time',
      friendlyName: 'Start Time',
      columnType: 'datetime',
      onCreate: () => {
        return Date.now();
      },
    });

    this.columnAdd({
      columnName: 'end_time',
      friendlyName: 'End Time',
      columnType: 'datetime',
      onCreate: () => {
        return Date.now();
      },
    });

    this.columnAdd({
      columnName: 'db',
      friendlyName: 'Database',
      columnType: 'string',
      hiddenList: true,
      hiddenUpdate: true,
    });

    this.columnAdd({
      columnName: 'table',
      friendlyName: 'Table',
      columnType: 'string',
      hiddenList: true,
      hiddenUpdate: true,
    });

    this.columnAdd({
      columnName: 'row',
      friendlyName: 'Row',
      columnType: 'integer',
      hiddenList: true,
      hiddenUpdate: true,
    });
    this.manyToOneAdd({
      referencedTableName: 'user',
      columnName: 'author',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'Viewer',
          listStyle: 'nowrap',
          hiddenCreate: true,
        },
      ],
      hiddenCreate: true,
      tabName: 'Views',
      defaultValue: ({req}) => {
        return req.user.id;
      },
    });
    this.methodAdd('getActiveViews', this.getActiveViews);
    this.methodAdd('logUser', this.logUser);
  }

  async logUser(args) {
    const currentEntry = await this.recordGet({
      where: {
        db: args.db,
        table: args.table,
        row: args.row,
        author: args.req.user.id,
      },
    });

    const currentTime = new Date().getTime() / 1000;
    const startTime = (currentEntry.end_time ?? 0) / 1000;
    const diff = currentTime - startTime;
    if (currentEntry && diff < 60) {
        await this.recordUpdate({
          recordId: currentEntry.id,
          data: {
            ...currentEntry,
            end_time: Date.now(),
          },
          req: args.req,
          audit: false,
        });
    } else {

      await this.recordCreate({
        data: {
          db: args.db,
          table: args.table,
          row: args.row,
        },
        audit: false,
        req: args.req,
      });
    }
    const result = await this.getActiveViews(args);
    return result
  }

  async getActiveViews(args) {
    const currentTime = new Date().getTime();
    let query = this.knex(this.dbDotTable);
    query = this.selectColumns({
      query,
      columns: this.columns,
      user: args?.req?.user,
      includeJoins: true,
      returnPasswords: false,
    });
    query = query
      .where({
        db: args.db,
        table: args.table,
        row: args.row,
      })
      .where('end_time', '>', currentTime - 20 * 1000);
    query = this.selectJoin({query})
    query.groupBy('author');
    const views = await this.queryRun(query);
    return {
      rows: views,
    };
  }
}
