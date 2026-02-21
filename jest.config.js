module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.module.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.dto.ts',
    '!src/main.ts',
    '!src/migrations/**',
  ],
  coverageDirectory: './coverage',
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    // Higher thresholds for critical medical modules
    './src/patients/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/medical-records/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/test/'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '.e2e-spec.ts$'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^uuid$': 'uuid',
    '^@nestjs/bullmq$': '<rootDir>/node_modules/@nestjs/bullmq',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
