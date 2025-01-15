import {RateLimiterMemory} from 'rate-limiter-flexible';
import {generateOpenAPI} from './registry.js';

export default function routes(fastify, options) {
  const packages = options.packages;

  const limiter = new RateLimiterMemory({
    keyPrefix: 'limiter',
    points: packages.config.limiter?.general?.points || 10 * 60 * 5, // 10 points per second over 5 minutes
    duration: packages.config.limiter?.general?.duration || 60 * 5, // Store number for five minutes
    blockDuration: packages.config.limiter?.general?.block || 60 * 5, // Block for 5 minutes
  });

  fastify.addHook('onRequest', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      request.user = null;
      console.log('No token found.');
      return;
    }

    request.user = packages.core.login.userFromToken({token});
  });

  fastify.get('/openapi', async (request, reply) => {
    const test = generateOpenAPI(packages.config.general.baseURL);
    return test;
  });

  fastify.get('/hello', async (request, reply) => {
    return {message: 'Hello World!'};
  });

  fastify.get('/', async (request, reply) => {
    return {message: 'Hello World!'};
  });

  fastify.all('/:packageName/:className/:action', async (...args) => {
    return await handlerFunction(packages, limiter, ...args);
  });

  fastify.all(
    '/:packageName/:className/:action/:recordId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            packageName: {type: 'string'},
            className: {type: 'string'},
            action: {type: 'string'},
            recordId: {type: 'number'},
          },
        },
      },
    },
    async (request, reply) => {
      return await handlerFunction(packages, limiter, request, reply);
    },
  );
}

async function handlerFunction(packages, limiter, req, res) {
  // Rate limit everything
  const ip = req.headers['x-forwarded-for'] || req.ip;
  try {
    const result = await limiter.consume(ip, 1);
    console.log('Remaining points: ', result.remainingPoints);
  } catch (e) {
    res.status(429);
    return {message: 'Too many requests. Try again later.'};
  }

  if (
    !packages[req.params.packageName] ||
    !packages[req.params.packageName][req.params.className] ||
    !packages[req.params.packageName][req.params.className].methodExecute // methodExecute is provided by the Base class. Everything should have it.
  ) {
    limiter.penalty(ip, 10);
    res.status(404);
    return {message: 'Not Found'};
  }

  // Methods that start with _ are not allowed to be called via api.
  if (req?.params?.action?.startsWith('_')) {
    limiter.penalty(ip, 10);
    res.status(404);
    return {
      message: 'Not Found. Methods starting with _ can not be called.',
    };
  }

  // key names that start with _ are not allowed to be called via the api
  if (Object.keys(req.body || {}).some((key) => key.startsWith('_'))) {
    limiter.penalty(ip, 10);
    res.status(500);
    return {
      message: 'Arguments starting with _ can not be specified remotely.',
    };
  }

  // Authentication check
  if (
    packages[req.params.packageName][req.params.className].methodAuthRequired({
      req,
      id: req.params.action,
    }) &&
    !req.user
  ) {
    limiter.penalty(ip, 10);
    res.status(401);
    return {message: 'Authentication Required.'};
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
    limiter.penalty(ip, 10);
    res.status(403);
    return {message: 'Unauthorized.'};
  }

  // reqObject is sent to the class methods. It is a subset of req with some additional treats.
  const reqObject = new Req({
    req,
    res,
  });

  // Make sure the properties are unique between the body and query params
  validateProperties(req.body || {}, req.query);

  if (packages[req.params.packageName]?.[req.params.className]) {
    try {
      const result = await packages[req.params.packageName][
        req.params.className
      ].methodExecute(req, req.params.action, {
        ...req.body,
        ...req.query,
        recordId: req.params.recordId,
        req: reqObject,
      });

      const time = Date.now() - reqObject.date;

      console.log(
        `Request, ${req?.user?.name}, ${req?.params?.packageName}, ${req?.params?.className}, ${req?.params?.action}, ${req?.params?.recordId}, ${time} ms`,
      );

      if (res.sent) {
        // the method sent its own response. This is only used for attachment download currently.
        return;
      }

      if (!result) {
        limiter.penalty(ip, 10);
        res.status(404);
        return {message: 'Not Found'};
      }

      // FIXME I dont like this. Maybe only used for SAML right now.
      if (result?.redirect) {
        return res.redirect(result.redirect);
      }

      return {
        data: result,
        messages: reqObject.messages,
        navigate: reqObject.navigate,
      };
    } catch (error) {
      console.error(error);
      limiter.penalty(ip, 10);
      res.status(500);
      return {message: error.message};
    }
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
          `Duplicate key: ${key}. Keys must be unique between url route params, query params and body.`,
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
  constructor({req, res}) {
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
    this.securityId = req.user?.securityId || null;
    this.req = req;
    this.res = res;
    this.navigate = null;
    this.ip = req.headers['x-forwarded-for'] || req.ip; // TODO validate this

    if (req.params.recordId) {
      req.record = {
        id: req.params.recordId,
        table: req.params.className,
        db: req.params.packageName,
      };
    }
  }

  navigateTo(path) {
    this.navigate = path;
  }

  message({
    severity = 'info', // effects the color of the toast message. Can be 'info', 'warn', 'error', 'success'
    summary = null, // title of the toast message. optional. If not provided, it will default to the severity
    detail = null, // body of the toast message. Required.
    life = 3000, // how long the toast message will be displayed in milliseconds
  }) {
    if (!detail) {
      throw new Error('Detail is required for a message.');
    }
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
    this.messages.push({severity, summary, detail, life});
  }
}
