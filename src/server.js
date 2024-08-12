import http from 'http';
import express from 'express';
import router from './lib/router.js';

export default class Backend {
  constructor(config) {
    this.config = {
      dbDirs: [],
      ...config,
    };
  }

  async start() {
    const { PORT = 3001 } = this.config;
    const app = express();
    this.server = http.createServer(app);

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api', await router(this.config));

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
}
