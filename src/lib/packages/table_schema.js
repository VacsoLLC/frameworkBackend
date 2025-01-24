import {record, z} from 'zod';
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export class TableSchema {
  constructor(defaultSortColumn = 'id', defaultSortOrder = 'DESC') {
    this.defaultSortColumn = defaultSortColumn;
    this.defaultSortOrder = defaultSortOrder;
    this.initializeSchemas();
  }

  // Common reusable schemas
  get recordId() {
    return z.coerce.number({
      required_error: 'Record ID is required',
      invalid_type_error: 'Record ID must be a number',
    });
  }

  get data() {
    return z.record(z.any());
  }

  get where() {
    return z.union([z.record(z.any()), z.array(z.any())]).optional();
  }

  get sortField() {
    return z.string().optional().default(this.defaultSortColumn);
  }

  get sortOrder() {
    return z.enum(['ASC', 'DESC']).optional().default(this.defaultSortOrder);
  }

  get limit() {
    return z.coerce.number().positive().optional().default(20);
  }

  get offset() {
    return z.coerce.number().min(0).optional().default(0);
  }

  get columns() {
    return z.array(z.string()).optional().default([]);
  }

  initializeSchemas() {
    // Schema for recordCreate method
    this.recordCreate = z
      .object({
        data: this.data,
      })
      .openapi('recordCreate');

    // Schema for recordUpdate method
    this.recordUpdate = z.object({
      recordId: this.recordId,
      data: this.data,
    });

    // Schema for recordDelete method
    this.recordDelete = z.object({
      recordId: this.recordId,
    });

    // Schema for recordGet method
    this.recordGet = z.object({
      recordId: this.recordId.optional(),
      where: this.where,
    });

    // Schema for rowsGet method
    this.rowsGet = z.object({
      where: this.where,
      sortField: this.sortField,
      sortOrder: this.sortOrder,
      limit: this.limit,
      offset: this.offset,
      returnCount: z.boolean().optional().default(false),
      includeDeleted: z.boolean().optional().default(false),
      columns: this.columns,
    });

    // Schema for schemaGet method
    this.schemaGet = z.object({
      recordId: this.recordId.optional(),
    });

    // Schema for actionsGet method
    this.actionsGet = z.object({
      id: this.recordId.optional(),
      type: z.enum(['table', 'record']).optional(),
    });

    // Schema for childrenGet method
    this.childrenGet = z.object({});
  }

  // Method to create a new instance with a different default sort
  withDefaultSort(defaultSort) {
    return new TableSchema(defaultSort);
  }
}

// Create a default instance with 'id' as the default sort
export const defaultSchema = new TableSchema();
