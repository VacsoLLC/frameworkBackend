import Base from '../base.js';
import fs from 'fs/promises';

export default class DataImporter extends Base {
  constructor(args) {
    super({ className: 'importer', ...args });
    this.importedRecords = new Map();
    this.methodAdd('importData', this.importData);
  }

  /**
   * Import data from a JSON file
   * @param {Object} options - The options for importing data
   * @param {string} options.jsonPath - The path to the JSON file containing the data to import
   * @param {Object} options.req - The request object
   * @returns {Promise<Object>} A message indicating the completion of the import process
   */
  async importData({ jsonPath, req }) {
    console.log('Starting import of data...');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const importData = JSON.parse(jsonData);

    // Global ignoreDuplicates setting (optional)
    const globalIgnoreDuplicates = importData.ignoreDuplicates || false;

    for (const entity of importData.entities) {
      // Use entity-specific setting if available, otherwise use global setting
      const ignoreDuplicates =
        entity.ignoreDuplicates !== undefined
          ? entity.ignoreDuplicates
          : globalIgnoreDuplicates;

      await this.importEntity(entity, req, ignoreDuplicates);
    }

    console.log('Data import completed');
    return { message: 'Data import completed successfully' };
  }

  /**
   * Import an entity and its records
   * @param {Object} entity - The entity to import
   * @param {Object} req - The request object
   * @param {boolean} ignoreDuplicates - Whether to ignore duplicate key errors
   * @returns {Promise<void>}
   */
  async importEntity(entity, req, ignoreDuplicates) {
    const [packageName, className] = entity.name.split('.');
    const EntityClass = this.packages[packageName][className];

    console.log(
      `Importing ${entity.name} (ignoreDuplicates: ${ignoreDuplicates})`
    );

    for (const record of entity.records) {
      await this.importRecord(
        EntityClass,
        record,
        entity.name,
        req,
        ignoreDuplicates
      );
    }
  }

  /**
   * Import a single record
   * @param {Object} EntityClass - The class representing the entity
   * @param {Object} recordData - The data of the record to import
   * @param {string} entityName - The name of the entity
   * @param {Object} req - The request object
   * @param {boolean} ignoreDuplicates - Whether to ignore duplicate key errors
   * @returns {Promise<void>}
   */
  async importRecord(
    EntityClass,
    recordData,
    entityName,
    req,
    ignoreDuplicates
  ) {
    const resolvedData = await this.resolveReferences(recordData);

    try {
      const result = await EntityClass.recordCreate({
        data: resolvedData,
        req,
      });

      console.log(`Created ${entityName} record: ${result.id}`);

      if (!this.importedRecords.has(entityName)) {
        this.importedRecords.set(entityName, []);
      }
      this.importedRecords
        .get(entityName)
        .push({ ...resolvedData, id: result.id });
    } catch (error) {
      if (ignoreDuplicates && error.code === 'ER_DUP_ENTRY') {
        console.log(
          `Ignoring duplicate entry for ${entityName}: ${JSON.stringify(
            resolvedData
          )}`
        );
      } else {
        console.error(`Error importing ${entityName} record:`, error);
        throw error;
      }
    }
  }

  /**
   * Resolve references in the record data
   * @param {Object} data - The record data containing references
   * @returns {Promise<Object>} The resolved record data
   */
  async resolveReferences(data) {
    const resolvedData = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && value.$ref) {
        resolvedData[key] = await this.resolveReference(value);
      } else {
        resolvedData[key] = value;
      }
    }

    return resolvedData;
  }

  /**
   * Resolve a single reference
   * @param {Object} ref - The reference object to resolve
   * @returns {Promise<number>} The resolved ID
   * @throws {Error} If the reference cannot be resolved
   */
  async resolveReference(ref) {
    const [packageName, className] = ref.$ref.split('.');
    const EntityClass = this.packages[packageName][className];

    const importedRecords = this.importedRecords.get(ref.$ref) || [];
    const matchingRecord = importedRecords.find((record) =>
      Object.entries(ref).every(
        ([key, value]) => key !== '$ref' && record[key] === value
      )
    );

    if (matchingRecord) {
      return matchingRecord.id;
    }

    const whereClause = Object.fromEntries(
      Object.entries(ref).filter(([key]) => key !== '$ref')
    );
    const existingRecord = await EntityClass.recordGet({ where: whereClause });

    if (existingRecord) {
      return existingRecord.id;
    }

    throw new Error(`Could not resolve reference: ${JSON.stringify(ref)}`);
  }
}
