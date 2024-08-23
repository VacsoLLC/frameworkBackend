import Base from '../base.js';

export default class Search extends Base {
  constructor(args) {
    super({ className: 'search', ...args });
    this.indexName = 'framework';
    this.methodAdd('search', this.search);
  }

  async init() {
    await this.initIndex();

    console.log('Search initialized');
  }

  async initIndex() {
    try {
      const response = await fetch(
        `http://localhost:8882/indexes/${this.indexName}`,
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
    } catch {
      console.error('Error initializing index:', error);
      throw error;
    }
  }

  async search({ query }) {
    console.log('Search query:', query);

    try {
      const response = await fetch(
        `http://localhost:8882/indexes/${this.indexName}/search`,
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
          `http://localhost:8882/indexes/${this.indexName}/documents/${id}`,
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
          `http://localhost:8882/indexes/${this.indexName}/documents`,
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
