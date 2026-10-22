import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';
import { DataResidencyRegion } from '../../enums/data-residency.enum';

export const DATA_RESIDENCY_CONFIG_KEY = 'dataResidency';

const schema = Joi.object({
  DB_HOST_EU: Joi.string().optional(),
  DB_PORT_EU: Joi.number().default(5432),
  DB_NAME_EU: Joi.string().default('healthy_stellar_eu'),
  EU_DB_URL: Joi.string().uri().allow('').optional(),

  DB_HOST_US: Joi.string().optional(),
  DB_PORT_US: Joi.number().default(5432),
  DB_NAME_US: Joi.string().default('healthy_stellar_us'),
  US_DB_URL: Joi.string().uri().allow('').optional(),

  DB_HOST_APAC: Joi.string().optional(),
  DB_PORT_APAC: Joi.number().default(5432),
  DB_NAME_APAC: Joi.string().default('healthy_stellar_apac'),
  APAC_DB_URL: Joi.string().uri().allow('').optional(),

  DB_HOST_AFRICA: Joi.string().optional(),
  DB_PORT_AFRICA: Joi.number().default(5432),
  DB_NAME_AFRICA: Joi.string().default('healthy_stellar_africa'),
  AFRICA_DB_URL: Joi.string().uri().allow('').optional(),

  DEFAULT_REGION: Joi.string().valid(...Object.values(DataResidencyRegion)).default(DataResidencyRegion.EU),

  STELLAR_HORIZON_EU_URL: Joi.string().uri().default('https://horizon.eu.stellar.org'),
  STELLAR_HORIZON_US_URL: Joi.string().uri().default('https://horizon.us.stellar.org'),
  STELLAR_HORIZON_APAC_URL: Joi.string().uri().default('https://horizon.apac.stellar.org'),
  STELLAR_HORIZON_AFRICA_URL: Joi.string().uri().default('https://horizon.africa.stellar.org'),

  IPFS_NODES_EU: Joi.string().default('https://ipfs-eu-1.infura.io:5001'),
  IPFS_NODES_US: Joi.string().default('https://ipfs-us-1.infura.io:5001'),
  IPFS_NODES_APAC: Joi.string().default('https://ipfs-apac-1.infura.io:5001'),
  IPFS_NODES_AFRICA: Joi.string().default('https://ipfs-africa-1.infura.io:5001'),
}).options({ allowUnknown: true });

export function validateDataResidencyConfig(config: Record<string, unknown>) {
  const { error } = schema.validate(config);
  if (error) {
    throw new Error(`Data residency configuration error: ${error.message}`);
  }
  return config;
}

export const dataResidencyConfig = registerAs(DATA_RESIDENCY_CONFIG_KEY, () => ({
  defaultRegion: process.env.DEFAULT_REGION || DataResidencyRegion.EU,
  eu: {
    dbType: process.env.DB_TYPE_EU || 'postgres',
    dbHost: process.env.DB_HOST_EU,
    dbPort: parseInt(process.env.DB_PORT_EU || '5432', 10),
    dbName: process.env.DB_NAME_EU || 'healthy_stellar_eu',
    dbUrl: process.env.EU_DB_URL || process.env.DB_URL_EU,
    horizonUrl: process.env.STELLAR_HORIZON_EU_URL || 'https://horizon.eu.stellar.org',
    ipfsNodes: (process.env.IPFS_NODES_EU || 'https://ipfs-eu-1.infura.io:5001').split(','),
  },
  us: {
    dbType: process.env.DB_TYPE_US || 'postgres',
    dbHost: process.env.DB_HOST_US,
    dbPort: parseInt(process.env.DB_PORT_US || '5432', 10),
    dbName: process.env.DB_NAME_US || 'healthy_stellar_us',
    dbUrl: process.env.US_DB_URL || process.env.DB_URL_US,
    horizonUrl: process.env.STELLAR_HORIZON_US_URL || 'https://horizon.us.stellar.org',
    ipfsNodes: (process.env.IPFS_NODES_US || 'https://ipfs-us-1.infura.io:5001').split(','),
  },
  apac: {
    dbType: process.env.DB_TYPE_APAC || 'postgres',
    dbHost: process.env.DB_HOST_APAC,
    dbPort: parseInt(process.env.DB_PORT_APAC || '5432', 10),
    dbName: process.env.DB_NAME_APAC || 'healthy_stellar_apac',
    dbUrl: process.env.APAC_DB_URL || process.env.DB_URL_APAC,
    horizonUrl: process.env.STELLAR_HORIZON_APAC_URL || 'https://horizon.apac.stellar.org',
    ipfsNodes: (process.env.IPFS_NODES_APAC || 'https://ipfs-apac-1.infura.io:5001').split(','),
  },
  africa: {
    dbType: process.env.DB_TYPE_AFRICA || 'postgres',
    dbHost: process.env.DB_HOST_AFRICA,
    dbPort: parseInt(process.env.DB_PORT_AFRICA || '5432', 10),
    dbName: process.env.DB_NAME_AFRICA || 'healthy_stellar_africa',
    dbUrl: process.env.AFRICA_DB_URL || process.env.DB_URL_AFRICA,
    horizonUrl: process.env.STELLAR_HORIZON_AFRICA_URL || 'https://horizon.africa.stellar.org',
    ipfsNodes: (process.env.IPFS_NODES_AFRICA || 'https://ipfs-africa-1.infura.io:5001').split(','),
  },
}));
