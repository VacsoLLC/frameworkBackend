import Base from '../base.js';

export default class Search extends Base {
  constructor(args) {
    super({ className: 'search', ...args });
    this.indexName = 'framework';
    this.host = process.env.MARQO_HOST || '127.0.0.1';
    this.port = 8882;
    this.connected = false;
    this.methodAdd('search', this.search);
  }

  async init() {
    this.initIndex();

    console.log('Search initialized');
  }

  /**
   * Initialize the search index with retry mechanism
   */
  async initIndex() {
    const maxRetries = 10;
    const baseDelay = 60000; // 1 minute

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          `http://${this.host}:${this.port}/indexes/${this.indexName}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'hf/e5-base-v2',
            }),
          }
        );

        if (response.status === 409) {
          console.log('Search Index already exists');
          this.connected = true;
          return;
        }

        if (!response.ok) {
          console.log(`Failed to create index: ${response.statusText}`);
        }

        this.connected = true;
        console.log('Search Index created successfully');
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw new Error(
            `Failed to initialize index after ${maxRetries} attempts: ${error.message}`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, baseDelay));
      }
    }
  }

  async search({ query }) {
    console.log('Search query:', query);

    try {
      const response = await fetch(
        `http://${this.host}:${this.port}/indexes/${this.indexName}/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: query,
            limit: 100,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { results: data.hits };
    } catch (error) {
      console.error('Error searching Marqo:', error);
      throw error;
    }
  }

  async updateIndex({ id, action, data }) {
    console.log(`Updating index for ${id}, action: ${action}`);

    try {
      if (action === 'delete') {
        const response = await fetch(
          `http://${this.host}:${this.port}/indexes/${this.indexName}/documents/${id}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } else {
        const response = await fetch(
          `http://${this.host}:${this.port}/indexes/${this.indexName}/documents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              documents: [
                {
                  ...data,
                  _id: id,
                },
              ],
              tensorFields: ['searchText'],
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Marqo index update result:', result);
        return result;
      }
    } catch (error) {
      console.error('Error updating Marqo index:', error);
      throw error;
    }
  }
}
