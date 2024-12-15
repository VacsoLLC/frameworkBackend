import Table from '../table.js';
import {systemUser} from '../../../util.js';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';
import {clouddebugger} from 'googleapis/build/src/apis/clouddebugger/index.js';
import fs from 'fs';
import {randomUUID} from 'crypto';
import path from 'path';
import {createWriteStream} from 'fs';
import {mkdir} from 'fs/promises';
import {pipeline} from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class Audit extends Table {
  constructor(args) {
    super({
      name: 'Attachment',
      className: 'attachment',
      index: false, // TODO add attachment indexing in the future
      ...args,
      options: {
        id: {
          hiddenList: true,
        },
      },
    });

    this.columnAdd({
      columnName: 'created',
      friendlyName: 'Created',
      columnType: 'datetime',
      hiddenCreate: true,
      readOnly: true,
      onCreate: () => {
        return Date.now();
      },
    });

    this.columnAdd({
      columnName: 'db',
      friendlyName: 'Database',
      columnType: 'string',
      hiddenList: true,
      hiddenUpdate: true,
    });

    this.columnAdd({
      columnName: 'table',
      friendlyName: 'Table',
      columnType: 'string',
      hiddenList: true,
      hiddenUpdate: true,
    });

    this.columnAdd({
      columnName: 'row',
      friendlyName: 'Row',
      columnType: 'integer',
      hiddenList: true,
      hiddenUpdate: true,
    });

    this.manyToOneAdd({
      referencedTableName: 'user',
      columnName: 'author',
      displayColumns: [
        {
          columnName: 'name',
          friendlyName: 'Author',
          listStyle: 'nowrap',
          hiddenCreate: true,
        },
      ],
      hiddenCreate: true,
      tabName: 'Attachments',
      defaultValue: ({req}) => {
        return req.user.id;
      },
    });

    this.columnAdd({
      columnName: 'filename',
      friendlyName: 'Filename',
      columnType: 'file',
    });

    this.columnAdd({
      columnName: 'storedFilename',
      friendlyName: 'Stored Filename',
      columnType: 'string',
      hidden: true,
    });

    this.columnAdd({
      columnName: 'image',
      friendlyName: 'Image',
      columnType: 'boolean',
    });

    this.methodAdd('upload', this.upload);
    this.methodAdd('download', this.download);
  }

  async download({recordId, req}) {
    const record = await this.recordGet({recordId});

    if (!record) {
      throw new Error('Record not found');
    }

    try {
      await fs.promises.access(record.storedFilename);
    } catch (error) {
      req.res.status(404);
      req.res.send('File not found');
      return;
    }

    const isPdf = record?.filename?.endsWith('.pdf');

    if (isPdf) {
      req.res.header(
        'Content-Disposition',
        `inline; filename="${record.filename}"`,
      );
      req.res.header('Content-Type', 'application/pdf');
    }
    req.res.status(200);

    const stream = fs.createReadStream(record.storedFilename);
    await req.res.send(stream);
  }

  async upload({id, req}) {
    const parts = await req.req.parts();

    const files = [];
    const fields = {};

    for await (const part of parts) {
      if (part.type == 'file') {
        console.log('TRIPPfile', part.filename);
        const storedFilename = await this.saveFile(part.file);
        files.push({
          name: part.filename,
          stored: storedFilename,
          image: part.mimetype.startsWith('image/'),
        });
      } else {
        console.log('TRIPP Not File', part);
        fields[part.fieldname] = part.value;
      }
    }

    for (const file of files) {
      await this.recordCreate({
        data: {
          filename: file.name,
          storedFilename: file.stored,
          db: fields.db,
          table: fields.table,
          row: fields.row,
          author: req.user.id,
          image: file.image,
        },
        req,
      });
    }

    return {};
  }

  async saveFile(fileStream, originalFilename) {
    // Generate GUID and get first 3 characters for directory structure
    const guid = randomUUID();
    const [dir1, dir2, dir3] = guid.split('');

    // Create the nested directory path
    const basePath = path.join(process.cwd(), 'uploads');
    const dir1Path = path.join(basePath, dir1);
    const dir2Path = path.join(dir1Path, dir2);
    const dir3Path = path.join(dir2Path, dir3);

    // Create directories recursively
    try {
      await mkdir(dir1Path, {recursive: true});
      await mkdir(dir2Path, {recursive: true});
      await mkdir(dir3Path, {recursive: true});
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    // Create full file path
    const filePath = path.join(dir3Path, guid);

    // Create write stream
    const writeStream = createWriteStream(filePath);

    // Pipe the file stream to disk
    try {
      await pipeline(fileStream, writeStream);

      // Return the GUID and full path
      return filePath;
    } catch (err) {
      // Clean up the write stream on error
      writeStream.destroy();
      throw err;
    }
  }
}
