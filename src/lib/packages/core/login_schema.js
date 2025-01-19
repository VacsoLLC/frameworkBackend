import {z} from 'zod';
import {extendZodWithOpenApi} from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Common reusable schemas
const email = z.string({
  required_error: 'Email is required',
  invalid_type_error: 'Email must be a string',
});

const password = z
  .string({
    required_error: 'Password is required',
    invalid_type_error: 'Password must be a string',
  })
  .min(1, {
    message: 'Password cannot be empty',
  });

const token = z
  .string({
    required_error: 'Token is required',
    invalid_type_error: 'Token must be a string',
  })
  .min(1, {
    message: 'Token cannot be empty',
  });

// Schema for getToken method
export const getToken = z
  .object({
    email,
    password,
  })
  .openapi('getToken');

// Schema for forgotPassword method
export const forgotPassword = z
  .object({
    email,
  })
  .openapi('forgotPassword');

// Schema for resetPassword method
export const resetPassword = z
  .object({
    token,
    password,
  })
  .openapi('resetPassword');

// Schema for createAccount method
export const createAccount = z
  .object({
    token,
    password,
    fullName: z
      .string({
        required_error: 'Full name is required',
        invalid_type_error: 'Full name must be a string',
      })
      .min(1, {
        message: 'Full name cannot be empty',
      }),
  })
  .openapi('createAccount');
