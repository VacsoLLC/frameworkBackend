import Table from '../table.js';
import {systemUser} from '../../../util.js';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

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

  // TODO permissions
  async download({recordId, req}) {
    const record = await this.recordGet({recordId});

    if (!record) {
      throw new Error('Record not found');
    }

    return new Promise((resolve, reject) => {
      // Please check this
      req.res.setHeader('Content-Disposition', 'inline; filename="sample.pdf"');
      req.res.setHeader('Content-Type', 'application/pdf'); 
      req.res
        .status(200)
        .sendFile(
          join(process.cwd(), 'uploads', record.storedFilename),
          null,
          (err) => {
            if (err) {
              console.error('Error sending file:', err);
              reject(err);
            } else {
              resolve();
            }
          },
        );
    });
  }

  async upload({db, table, row, req}) {
    const files = req.req.files;

    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    const attachmentRecords = [];

    for (const file of files) {
      const attachmentRecord = await this.recordCreate({
        data: {
          filename: file.originalname,
          storedFilename: file.filename,
          db,
          table,
          row,
          author: req.user.id,
          image: file.mimetype.startsWith('image/'),
        },
        req,
      });

      attachmentRecords.push(attachmentRecord);
    }

    return {
      ok: true,
      attachmentRecords,
    };
  }
}
