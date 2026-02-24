module.exports = {
  hash: jest.fn(async () => 'mocked-hash'),
  compare: jest.fn(async () => true),
};
