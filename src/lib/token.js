import jwt from 'jsonwebtoken';

export function createToken(user, config) {
  return jwt.sign(user, config.token.secret, config.token.options);
}

export function verifyToken(token, config) {
  return jwt.verify(token, config.token.secret);
}
