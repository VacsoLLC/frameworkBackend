import { fileURLToPath, pathToFileURL } from 'url';

import { readdir } from 'fs/promises';
import { join, basename, resolve } from 'path';

export async function loadFromDir(dir) {
  const modules = {};
  try {
    // Read all files in the directory
    const files = await readdir(dir);

    // Process each file
    for (const file of files) {
      if (file.endsWith('.js')) {
        try {
          // Compute the full path to the file
          const filePath = join(dir, file);

          // Resolve the full path to an absolute path
          const absolutePath = resolve(filePath);

          // Convert the absolute path to a file URL
          const fileURL = pathToFileURL(absolutePath);

          // Dynamically import the file
          const module = await import(fileURL.href);

          // Get the filename without the .js extension
          const moduleName = basename(file, '.js');

          // Assign the imported module (default or named exports) to the modules object
          modules[moduleName] = module.default || module;
        } catch (error) {
          // Log the error related to importing this specific file
          console.error(`Failed to import ${file}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to read directory:', error);
    throw error; // Rethrow error if reading the directory fails
  }

  // Return the populated modules object
  return modules;
}
