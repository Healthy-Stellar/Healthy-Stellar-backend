module.exports = {
  // Separate projects for unit and e2e tests
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: '.',
      transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
      },
      collectCoverageFrom: [
        'src/**/*.(t|j)s',
        '!src/**/*.module.ts',
        '!src/**/*.entity.ts',
        '!src/**/*.dto.ts',
        '!src/**/*.interface.ts',
        '!src/**/*.enum.ts',
        '!src/**/*.constant.ts',
        '!src/main.ts',
        '!src/migrations/**',
        '!src/**/index.ts',
      ],
      coverageDirectory: './coverage/unit',
      coveragePathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/test/',
        '.e2e-spec.ts$',
      ],
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@test/(.*)$': '<rootDir>/test/$1',
        '^uuid$': 'uuid',
        '^@nestjs/bullmq$': '<rootDir>/node_modules/@nestjs/bullmq',
      },
      setupFilesAfterEnv: ['<rootDir>/test/setup-unit.ts'],
      globals: {
        'ts-jest': {
          isolatedModules: true,
        },
      },
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: '.',
      transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
      },
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@test/(.*)$': '<rootDir>/test/$1',
      },
      setupFilesAfterEnv: ['<rootDir>/test/setup-e2e.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      globalTeardown: '<rootDir>/test/global-teardown.ts',
      testTimeout: 60000,
    },
  ],
  // Global coverage thresholds
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
    // Higher thresholds for critical medical modules
    './src/patients/**/*.ts': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
    './src/medical-records/**/*.ts': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
    './src/records/**/*.ts': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
    './src/audit/**/*.ts': {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
  },
};
