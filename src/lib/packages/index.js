import fs from 'fs';
import path, {dirname} from 'path';
import {fileURLToPath} from 'url';
import m2m from './m2m.js';

export default class DB {
  constructor(config) {
    this.packages = {}; // Store tables inside databases
    this.config = config;
    this.dirs = [...config.dbDirs];

    const currentDirectory = dirname(fileURLToPath(import.meta.url));

    this.dirs.unshift(currentDirectory);
  }

  async init() {
    for (const packageDir of this.dirs) {
      const packageNames = fs.readdirSync(packageDir);

      for (const packageName of packageNames) {
        if (!fs.statSync(path.join(packageDir, packageName)).isDirectory()) {
          // Skip this iteration if it's not a directory
          continue;
        }
        const classDir = path.join(packageDir, packageName);
        const classFiles = fs.readdirSync(classDir);

        let manyToManys = [];
        let addRecords = [];
        for (const file of classFiles) {
          if (
            fs.statSync(path.join(classDir, file)).isDirectory() ||
            file.includes('_schema')
          ) {
            // Skip this iteration if it's a directory
            continue;
          }

          const module = await import(toFileURL(path.join(classDir, file)));
          const moduleClass = module.default;
          const classInstance = new moduleClass({
            db: packageName,
            packageName: packageName,
            packages: this.packages,
            config: this.config,
          });

          if (!this[packageName]) {
            this[packageName] = {};
            this.packages[packageName] = {};
          }

          this[packageName][classInstance.className] = classInstance;
          this.packages[packageName][classInstance.className] = classInstance;

          if (classInstance.manyToMany) {
            manyToManys.push(...classInstance.manyToMany);
          }

          if (classInstance.addRecords) {
            addRecords.push(...classInstance.addRecords);
          }
        }

        for (const manyToMany of manyToManys) {
          const m2mInstance = new m2m({
            m2m: manyToMany,
            dbs: this,
            packages: this.packages,
          });
          this[packageName][m2mInstance.className] = m2mInstance;
          this.packages[packageName][m2mInstance.className] = m2mInstance;
        }

        for (const addRecord of addRecords) {
          this[addRecord.packageName][
            addRecord.className
          ].insertQueueForThisTable.push(addRecord);
        }
      }
    }

    for (const packageName of Object.keys(this.packages)) {
      for (const className of Object.keys(this.packages[packageName])) {
        if (this.packages[packageName][className].init) {
          await this.packages[packageName][className].init(this.packages);
        }
      }
    }
  }
}

function toFileURL(filePath) {
  const pathName = path.resolve(filePath).replace(/\\/g, '/');
  return `file://${pathName}`;
}
