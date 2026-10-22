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
}).options({ allowUnknown: true, abortEarly: false });
