module.exports = {
  Server: jest.fn().mockImplementation(() => ({
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
  })),
  Keypair: {
    random: jest.fn(() => ({
      publicKey: jest.fn(() => 'MOCK_PUBLIC_KEY'),
      secret: jest.fn(() => 'MOCK_SECRET_KEY'),
    })),
    fromSecret: jest.fn(() => ({
      publicKey: jest.fn(() => 'MOCK_PUBLIC_KEY'),
    })),
  },
  TransactionBuilder: jest.fn(),
  Operation: { payment: jest.fn() },
  Asset: { native: jest.fn() },
  Networks: {
    TESTNET: 'Test SDF Network ; September 2015',
    PUBLIC: 'Public Global Stellar Network ; September 2015',
  },
};
