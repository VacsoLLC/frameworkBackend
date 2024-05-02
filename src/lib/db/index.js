import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import m2m from './m2m.js';

export default class DB {
  constructor(config) {
    this.databases = {}; // Store tables inside databases
    this.config = config;
    this.dirs = [...config.dbDirs];

    const currentDirectory = dirname(fileURLToPath(import.meta.url));
    const dbDir = path.join(currentDirectory, 'databases');

    this.dirs.unshift(dbDir);
  }

  async init() {
    for (const dbDir of this.dirs) {
      const dbNames = fs.readdirSync(dbDir);

      for (const dbName of dbNames) {
        const tableDir = path.join(dbDir, dbName);
        const tableFiles = fs.readdirSync(tableDir);

        let manyToManys = [];
        let addRecords = [];
        for (const file of tableFiles) {
          if (fs.statSync(path.join(tableDir, file)).isDirectory()) {
            // Skip this iteration if it's a directory
            continue;
          }

          const module = await import(toFileURL(path.join(tableDir, file)));
          const tableClass = module.default;
          const tableInstance = new tableClass({
            db: dbName,
            dbs: this,
            config: this.config,
          });

          if (!this[dbName]) {
            this[dbName] = {};
            this.databases[dbName] = {};
          }

          this[dbName][tableInstance.table] = tableInstance;
          this.databases[dbName][tableInstance.table] = tableInstance;

          if (tableInstance.manyToMany) {
            manyToManys.push(...tableInstance.manyToMany);
          }

          if (tableInstance.addRecords) {
            addRecords.push(...tableInstance.addRecords);
          }
        }

        for (const manyToMany of manyToManys) {
          const m2mInstance = new m2m({ m2m: manyToMany, dbs: this });
          this[dbName][m2mInstance.table] = m2mInstance;
          this.databases[dbName][m2mInstance.table] = m2mInstance;
        }

        for (const addRecord of addRecords) {
          this[addRecord.db][addRecord.table].insertQueueForThisTable.push(
            addRecord
          );
        }
      }
    }

    for (const db of Object.keys(this.databases)) {
      for (const table of Object.keys(this.databases[db])) {
        if (this.databases[db][table].init) {
          await this.databases[db][table].init(this.databases);
        }
      }
    }
  }
}

function toFileURL(filePath) {
  const pathName = path.resolve(filePath).replace(/\\/g, '/');
  return `file://${pathName}`;
}
