import Base from '../base.js';
import fs from 'fs/promises';


export default class DataImporter extends Base {
  constructor(args) {
    super({ className: 'importer', ...args });
    this.importedRecords = new Map();
    this.methodAdd('importData', this.importData);
  }

  async importData({ jsonPath, req }) {
    console.log('Starting import of data...');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const importData = JSON.parse(jsonData);

    for (const entity of importData.entities) {
      await this.importEntity(entity, req);
    }

    console.log('Data import completed');
    return { message: 'Data import completed successfully' };
  }

  async importEntity(entity, req) {
    const [packageName, className] = entity.name.split('.');
    const EntityClass = this.packages[packageName][className];

    for (const record of entity.records) {
      await this.importRecord(EntityClass, record, entity.name, req);
    }
  }

  async importRecord(EntityClass, recordData, entityName, req) {
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
      console.error(`Error importing ${entityName} record:`, error);
      throw error;
    }
  }

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
