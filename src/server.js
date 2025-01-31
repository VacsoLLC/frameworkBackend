import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';

import router from './lib/router.js';
import Packages from './lib/packages/index.js';
import path from 'path';

import {systemRequest} from './util.js';

function Logger(...args) {
  this.args = args;
}
Logger.prototype.info = function (msg) {
  console.log('Fastify info', msg);
};
Logger.prototype.error = function (msg) {
  console.log('Fastify error', msg);
};
Logger.prototype.debug = function (msg) {
  console.log('Fastify debug', msg);
};
Logger.prototype.fatal = function (msg) {
  console.log('Fastify fatal', msg);
};
Logger.prototype.warn = function (msg) {
  console.log('Fastify warn', msg);
};
Logger.prototype.trace = function (msg) {
  console.log('Fastify trace', msg);
};
Logger.prototype.child = function () {
  return new Logger();
};

const myLogger = new Logger();

export default class Backend {
  constructor(config) {
    this.config = {
      dbDirs: [],
      ...config,
    };

    this.fastify = Fastify({
      logger: {
        logger: myLogger,
      },
    });
  }

  async start() {
    // Load up all the packages
    this.packages = new Packages(this.config);

    if (process.argv.includes('--index-all')) {
      this.config.noBackgroundTasks = true;
      await this.packages.init();
      await this.indexAllTables();
      process.exit(0);
    }

    const importDataArg = process.argv.find((arg) =>
      arg.startsWith('--import-data='),
    );

    if (importDataArg) {
      this.config.noBackgroundTasks = true;
      await this.packages.init();
      await this.importData(importDataArg.split('=')[1]);
      process.exit(0);
    }

    await this.packages.init();

    const {PORT = 3001} = this.config;

    this.fastify.register(fastifyMultipart, {
      limits: {
        fileSize: 1024 * 1024 * 250, // 250MB
        files: 100, // 100 files
      },
    });

    this.fastify.register(router, {
      prefix: '/api',
      packages: this.packages,
    });

    this.fastify.listen(
      {
        host: '0.0.0.0',
        port: PORT,
      },
      function (err, address) {
        if (err) {
          console.log(err);
          process.exit(1);
        }
        // Server is now listening on ${address}
        console.log(`API server is now listening on ${address}`);
      },
    );

    // Handle SIGTERM signal
    process.on('SIGTERM', this.stop);

    // Handle SIGINT signal (Ctrl+C)
    process.on('SIGINT', this.stop);
  }

  async stop() {
    console.log('Shutting down gracefully...');
    await this.fastify.close();
    console.log('Server closed');
    process.exit(0);
  }

  async indexAllTables() {
    console.log('Starting full index of all tables...');
    for (const packageName of Object.keys(this.packages)) {
      for (const className of Object.keys(this.packages[packageName])) {
        const table = this.packages[packageName][className];
        if (table.indexAllRecords && table.index) {
          await table.indexAllRecords();
        }
      }
    }
    console.log('Finished full index of all tables.');
  }

  async importData(jsonPath) {
    console.log('Starting import of data...');

    const fullJsonPath = path.resolve(this.config.currentDirectory, jsonPath);

    await this.packages.core.importer.importData({
      jsonPath: fullJsonPath,
      req: systemRequest(this),
    });
    console.log('Finished import of data.');
  }
}
