const RedisMock = jest.fn().mockImplementation(() => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(() => []),
  flushdb: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
}));
module.exports = RedisMock;
