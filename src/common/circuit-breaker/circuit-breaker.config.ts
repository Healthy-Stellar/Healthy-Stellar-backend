import { ConsecutiveBreaker, ExponentialBackoff, handleAll, retry, circuitBreaker, wrap } from 'cockatiel';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  failureWindow: number; // seconds
  halfOpenAfter: number; // seconds
  retryAttempts?: number;
  retryBackoff?: number;
}

export const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  stellar: {
    failureThreshold: 5,
    failureWindow: 30,
    halfOpenAfter: 60,
    retryAttempts: 3,
    retryBackoff: 500,
  },
  ipfs: {
    failureThreshold: 3,
    failureWindow: 20,
    halfOpenAfter: 45,
    retryAttempts: 3,
    retryBackoff: 300,
  },
  kms: {
    failureThreshold: 2,
    failureWindow: 10,
    halfOpenAfter: 30,
    retryAttempts: 2,
    retryBackoff: 200,
  },
  mail: {
    failureThreshold: 3,
    failureWindow: 20,
    halfOpenAfter: 45,
    retryAttempts: 3,
    retryBackoff: 300,
  },
};

export function createCircuitBreaker(serviceName: string, config: CircuitBreakerConfig) {
  const breaker = new ConsecutiveBreaker(config.failureThreshold);

  const cbPolicy = circuitBreaker(handleAll, {
    halfOpenAfter: config.halfOpenAfter * 1000, // convert to ms
    breaker,
  });

  return cbPolicy;
}

