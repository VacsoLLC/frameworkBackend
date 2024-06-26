import express from 'express';
import Packages from './packages/index.js';
import readline from 'readline';

let packages;
let config;

export default async function router(tempconfig) {
  config = tempconfig; // this sucks, fix this

  // Load up all the packages
  packages = new Packages(config);
  await packages.init(config);

  const routerReturn = express.Router();

  // Apply the token middleware
  routerReturn.use(processToken);

  routerReturn.get('/hello', async (_req, res) => {
    return res.status(200).json({ message: 'Hello World!' });
  });

  routerReturn.get('/', async (_req, res) => {
    return res.status(200).json({ message: 'Hello World!' });
  });

  routerReturn.all('/:packageName/:className/:action', handlerFunction);
  routerReturn.all(
    '/:packageName/:className/:action/:recordId',
    handlerFunction
  );

  return routerReturn;
}

async function handlerFunction(req, res) {
  if (
    !packages[req.params.packageName] ||
    !packages[req.params.packageName][req.params.className] ||
    !packages[req.params.packageName][req.params.className][req.params.action]
  ) {
    return res.status(404).json({ message: 'Not Found' });
  }

  // If the method starts with _, return 404
  if (req?.params?.action?.startsWith('_')) {
    return res.status(404).json({
      message: 'Not Found. Methods starting with _ can not be called.',
    });
  }

  // Authentication check
  if (
    packages[req.params.packageName][req.params.className]
      .authenticationRequired &&
    !req.user
  ) {
    return res.status(401).json({ message: 'Authentication Required.' });
  }

  // Authorization check
  if (
    packages[req.params.packageName][req.params.className]
      .authenticationRequired &&
    !(await packages[req.params.packageName][req.params.className].authorized({
      req,
      action: req.params.action,
    }))
  ) {
    return res.status(403).json({ message: 'Unauthorized.' });
  }

  // reqObject is sent to the class methods. It is a subset of req with some additional treats.
  const reqObject = new Req({
    req,
  });

  // Make sure the properties are unique between the body and query params
  validateProperties(req.body, req.query);

  try {
    const result = await packages[req.params.packageName][req.params.className][
      req.params.action
    ]({
      ...req.body,
      ...req.query,
      recordId: req.params.recordId,
      req: reqObject,
    });

    const time = Date.now() - reqObject.date;

    console.log(
      `Request, ${req?.user?.name}, ${req?.params?.packageName}, ${req?.params?.className}, ${req?.params?.action}, ${req?.params?.recordId}, ${time} ms`
    );

    if (result === null || result === undefined) {
      return res.status(200);
    }

    // FIXME I dont like this
    if (result?.redirect) {
      return res.redirect(result.redirect);
    }

    return res.status(200).json({
      data: result,
      messages: reqObject.messages,
    });
  } catch (error) {
    console.error(error);

    return res
      .status(500)
      .json({ message: 'Server Error', error: error.message });
  }
}

function processToken(req, res, next) {
  // Get the token from the request header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    req.user = null;
    console.log('No token found.');
    return next();
  }

  req.user = packages.core.login.userFromToken({ token });

  return next();
}

function validateProperties(...objects) {
  let keysSet = new Set();

  objects.forEach((obj) => {
    Object.keys(obj).forEach((key) => {
      if (!keysSet.has(key)) {
        keysSet.add(key);
      } else {
        throw new Error(
          `Duplicate key: ${key}. Keys must be unique between url route params, query params and body.`
        );
      }
    });
  });

  if (keysSet.has('req')) {
    throw new Error('req is a reserved key');
  }

  if (keysSet.has('recordId')) {
    throw new Error('recordId is a reserved key');
  }
}

class Req {
  constructor({ req }) {
    this.action = req.params.action;
    this.packageName = req.params.packageName;
    this.className = req.params.className;
    this.db = req.params.packageName; // TODO find these and fix them
    this.table = req.params.className; // TODO find these and fix them
    this.messages = [];
    this.date = Date.now();
    this.body = req.body;
    this.params = req.params;
    this.user = req.user;

    if (req.params.recordId) {
      req.record = {
        id: req.params.recordId,
        table: req.params.className,
        db: req.params.packageName,
      };
    }
  }

  message({
    severity = 'info',
    summary = null,
    detail = 'This is a message.',
    life = 3000,
  }) {
    if (!summary) {
      switch (severity) {
        case 'info':
          summary = 'Info';
          break;
        case 'warn':
          summary = 'Warning';
          break;
        case 'error':
          summary = 'Error';
          break;
        case 'success':
          summary = 'Success';
          break;
        default:
          summary = 'Info';
      }
    }
    this.messages.push({ severity, summary, detail, life });
  }
}
