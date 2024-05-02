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
    const httpServer = http.createServer(app);

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api', await router(this.config));

    httpServer.listen(PORT, () => {
      console.log(`Server listening at http://localhost:${PORT}`);
    });
  }
}


