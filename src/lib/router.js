import express from 'express';
import DB from './db/index.js';
import Menu from './menu.js';
import Saml from './saml.js';
import User from './user.js';
import { createToken, verifyToken } from './token.js';

let db;
let config;

export default async function router(tempconfig) {
  
  config = tempconfig; // this sucks, fix this

  db = new DB(config);

  const routerReturn = express.Router();

  // Load up DB

  await db.init(config);

  // Setup SAML routes before auth
  const saml = new Saml(routerReturn, db, config);

  // Apply the authentication middleware
  routerReturn.use(authenticateToken);

  // Load up Menu, passing in db and router
  const menu = new Menu(routerReturn, db);

  routerReturn.get('/hello', async (_req, res) => {
    return res.status(200).json({ message: 'Hello World!' });
  });

  routerReturn.get('/', async (_req, res) => {
    return res.status(200).json({ message: 'Hello World!' });
  });

  routerReturn.all('/db/:db/:table/:action', handlerFunction);
  routerReturn.all('/db/:db/:table/:action/:recordId', handlerFunction);

  routerReturn.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await authenticateUser(email, password);

    if (!user) {
      console.log('Authentication failed');

      return res.status(402).json({ message: 'Authentication failed.' });
    }

    console.log('Authentication successful');
    const token = createToken(user, this.config);
    res.json({ message: 'Authentication successful', token });
  });

  return routerReturn;
}

async function handlerFunction(req, res) {
  if (
    !db[req.params.db] ||
    !db[req.params.db][req.params.table] ||
    !db[req.params.db][req.params.table][req.params.action]
  ) {
    return res.status(404).json({ message: 'Not Founnd' });
  }

  if (
    !(await db[req.params.db][req.params.table].authorized({
      req,
      action: req.params.action,
    }))
  ) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  validateProperties(req.body, req.query);

  req.date = Date.now();
  req.action = req.params.action;
  req.db = req.params.db;
  req.table = req.params.table;

  if (req.params.recordId) {
    req.record = {
      id: req.params.recordId,
      table: req.params.table,
      db: req.params.db,
    };
  }

  try {
    const result = await db[req.params.db][req.params.table][req.params.action](
      {
        ...req.body,
        ...req.query,
        recordId: req.params.recordId,
        req,
      }
    );

    const time = Date.now() - req.date;
    console.log(
      `Request ${req.user.name} ${req.params.db} ${req.params.table} ${req.params.action} ${req.params.recordId} Took: ${time} ms`
    );
    if (result === null) {
      return res.status(200);
    }

    return res.status(200).json(result);
  } catch (error) {
    // Make sure to handle errors properly
    console.log('Error', error);
    console.error(error);

    return res
      .status(500)
      .json({ message: 'Server Error', error: error.message });
  }
}

async function authenticateUser(email, password) {
  console.log('Logging in', email, password);

  const user = await db.core.user.auth(email, password);

  if (!user) {
    return null;
  }

  return {
    ...user,
  };
}

async function authenticateToken(req, res, next) {
  // Allow unauthenticated access to /login
  if (
    req.path.startsWith('/saml') ||
    req.path === '/login' ||
    req.path === '/'
  ) {
    return next();
  }

  // Get the token from the request header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res
      .status(401)
      .send(
        'Access Denied: No token provided! Looking for authorization header with a value of "Bearer TOKENHERE".'
      );
  }

  try {
    // Verify the token
    const verified = verifyToken(token, config);

    req.user = new User({
      ...verified,
      db: db,
    });
    //req.user = verified;
    next();
  } catch (error) {
    console.log('Failed to verify user token.', error);
    res.status(401).send('Invalid Token');
  }
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
