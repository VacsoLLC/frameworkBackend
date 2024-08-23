import http from 'http';
import express from 'express';
import router from './lib/router.js';
import Packages from './lib/packages/index.js';

export default class Backend {
  constructor(config) {
    this.config = {
      dbDirs: [],
      ...config,
    };
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

    await this.packages.init();

    const { PORT = 3001 } = this.config;
    const app = express();
    this.server = http.createServer(app);

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api', await router(this.packages));

    this.server.listen(PORT, () => {
      console.log(`Server listening at http://localhost:${PORT}`);
    });

    // Handle SIGTERM signal
    process.on('SIGTERM', this.stop);

    // Handle SIGINT signal (Ctrl+C)
    process.on('SIGINT', this.stop);
  }

  stop() {
    console.log('Shutting down gracefully...');
    if (this.server) {
      this.server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
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
}
