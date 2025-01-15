import {record, z} from 'zod';
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Common reusable schemas

const recordId = z.number({
  required_error: 'Record ID is required',
  invalid_type_error: 'Record ID must be a number',
});

const data = z.record(z.any());

const where = z.union([z.record(z.any()), z.array(z.any())]).optional();

const sortField = z.string().optional();

const sortOrder = z.enum(['ASC', 'DESC']).optional();

const limit = z.number().positive().optional();

const offset = z.number().min(0).optional();

const columns = z.array(z.string()).optional();

// Schema for recordCreate method
export const recordCreate = z
  .object({
    data,
  })
  .openapi('recordCreate');

// Schema for recordUpdate method
export const recordUpdate = z.object({
  recordId,
  data,
});

// Schema for recordDelete method
export const recordDelete = z.object({
  recordId,
});

// Schema for recordGet method
export const recordGet = z.object({
  recordId: recordId.optional(),
  where,
});

// Schema for rowsGet method
export const rowsGet = z.object({
  where,
  sortField,
  sortOrder,
  limit,
  offset,

  returnCount: z.boolean().optional(),

  columns,
});

// Schema for schemaGet method
export const schemaGet = z.object({
  recordId: recordId.optional(),
});

// Schema for actionsGet method
export const actionsGet = z.object({
  id: recordId.optional(),
  type: z.enum(['table', 'record']).optional(),
});

// Schema for childrenGet method
export const childrenGet = z.object({});
