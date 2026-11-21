import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  // Database — required
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().integer().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_POOL_MIN: Joi.number().integer().min(1).default(2),
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),
  DB_SSL_ENABLED: Joi.string().valid('true', 'false').default('false'),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().default(10000),
  DB_QUERY_TIMEOUT_MS: Joi.number().integer().default(30000),
  DB_CONNECTION_TIMEOUT_MS: Joi.number().integer().default(2000),
  DB_IDLE_TIMEOUT_MS: Joi.number().integer().default(30000),
  DB_SLOW_QUERY_MS: Joi.number().integer().default(100),

  // Auth — required
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // Break-glass access windows (milliseconds)
  BREAK_GLASS_TTL_MS: Joi.number().integer().positive().default(4 * 60 * 60 * 1000),
  BREAK_GLASS_REVIEW_SLA_MS: Joi.number().integer().positive().default(24 * 60 * 60 * 1000),
  IDEMPOTENCY_TTL_MS: Joi.number().integer().positive().default(86_400_000),
  RECORDING_RETENTION_DAYS: Joi.number().integer().positive().default(2555),
  KEK_ROTATION_INTERVAL_DAYS: Joi.number().integer().positive().default(90),
  RECORD_RETENTION_YEARS: Joi.number().integer().positive().default(7),

  // Password and account lockout policy
  PASSWORD_MIN_LENGTH: Joi.number().integer().min(8).default(12),
  PASSWORD_EXPIRATION_DAYS: Joi.number().integer().positive().default(90),
  PASSWORD_HISTORY_COUNT: Joi.number().integer().min(0).default(12),
  LOCKOUT_THRESHOLD: Joi.number().integer().positive().default(5),
  LOCKOUT_DURATION_MINUTES: Joi.number().integer().positive().default(30),

  // Redis — required
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().integer().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // Stellar
  STELLAR_NETWORK: Joi.string().valid('testnet', 'mainnet').default('testnet'),
  STELLAR_SECRET_KEY: Joi.string().required(),
  STELLAR_CONTRACT_ID: Joi.string().required(),
  STELLAR_FEE_BUDGET: Joi.number().integer().default(10000000),
  STELLAR_MAX_RETRIES: Joi.number().integer().default(3),

  // Encryption — required
  ENCRYPTION_KEY: Joi.string().min(64).required(),

  // CORS
  ALLOWED_ORIGINS: Joi.string().required(),

  // Metrics
  METRICS_TOKEN: Joi.string().required(),

  // Queue integrity
  QUEUE_HMAC_SECRET: Joi.string().min(32).required(),

  // Rate limiting
  RATE_LIMIT_TTL: Joi.number().integer().default(60),
  RATE_LIMIT_MAX: Joi.number().integer().default(100),

  // Swagger / OpenAPI metadata
  SWAGGER_SERVER_URLS: Joi.string().default('http://localhost:3000'),
  SWAGGER_CONTACT_NAME: Joi.string().default('API Support'),
  SWAGGER_CONTACT_EMAIL: Joi.string().email().default('api-support@example.com'),
  SWAGGER_CONTACT_URL: Joi.string().uri().default('https://example.com/support'),
  SWAGGER_LICENSE_NAME: Joi.string().default('UNLICENSED'),
  SWAGGER_LICENSE_URL: Joi.string().uri().allow('').default(''),
}).options({ allowUnknown: true, abortEarly: false });
