import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IPolicy } from 'cockatiel';
import { Counter, Gauge, register } from 'prom-client';
import {
  CIRCUIT_BREAKER_CONFIGS,
  CircuitBreakerConfig,
  createCircuitBreaker,
} from './circuit-breaker.config';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerState {
  service: string;
  state: CircuitState;
  lastStateChange: Date;
  failureCount: number;
  successCount: number;
}

@Injectable()
export class CircuitBreakerService implements OnModuleInit {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, IPolicy>();
  private readonly states = new Map<string, CircuitBreakerState>();

  // Prometheus metrics
  private readonly stateGauge: Gauge<string>;
  private readonly stateChangeCounter: Counter<string>;

  constructor() {
    // Initialize Prometheus metrics
    this.stateGauge = new Gauge({
      name: 'medchain_circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
      labelNames: ['service'],
      registers: [register],
    });

    this.stateChangeCounter = new Counter({
      name: 'medchain_circuit_breaker_state_changes_total',
      help: 'Total number of circuit breaker state changes',
      labelNames: ['service', 'from_state', 'to_state'],
      registers: [register],
    });
  }

  onModuleInit() {
    // Initialize circuit breakers for all configured services
    Object.entries(CIRCUIT_BREAKER_CONFIGS).forEach(([serviceName, config]) => {
      this.initializeBreaker(serviceName, config);
    });

    this.logger.log(
      `Circuit breakers initialized for services: ${Array.from(this.breakers.keys()).join(', ')}`,
    );
  }

  private initializeBreaker(serviceName: string, config: CircuitBreakerConfig): void {
    const policy = createCircuitBreaker(serviceName, config);

    // Track state changes
    policy.onBreak(() => {
      this.handleStateChange(serviceName, 'open');
    });

    policy.onReset(() => {
      this.handleStateChange(serviceName, 'closed');
    });

    policy.onHalfOpen(() => {
      this.handleStateChange(serviceName, 'half-open');
    });

    policy.onSuccess(() => {
      const state = this.states.get(serviceName);
      if (state) {
        state.successCount++;
      }
    });

    policy.onFailure(() => {
      const state = this.states.get(serviceName);
      if (state) {
        state.failureCount++;
      }
    });

    this.breakers.set(serviceName, policy);
    this.states.set(serviceName, {
      service: serviceName,
      state: 'closed',
      lastStateChange: new Date(),
      failureCount: 0,
      successCount: 0,
    });

    // Initialize metric
    this.updateMetric(serviceName, 'closed');
  }

  private handleStateChange(serviceName: string, newState: CircuitState): void {
    const currentState = this.states.get(serviceName);
    const oldState = currentState?.state || 'closed';

    this.logger.warn(
      `Circuit breaker state transition: service=${serviceName} from=${oldState} to=${newState}`,
    );

    if (currentState) {
      currentState.state = newState;
      currentState.lastStateChange = new Date();
    }

    // Update Prometheus metrics
    this.updateMetric(serviceName, newState);
    this.stateChangeCounter.inc({
      service: serviceName,
      from_state: oldState,
      to_state: newState,
    });
  }

  private updateMetric(serviceName: string, state: CircuitState): void {
    const stateValue = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
    this.stateGauge.set({ service: serviceName }, stateValue);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(serviceName: string, fn: () => Promise<T>): Promise<T> {
    const breaker = this.breakers.get(serviceName);
    if (!breaker) {
      throw new Error(`Circuit breaker not found for service: ${serviceName}`);
    }

    try {
      return await breaker.execute(fn);
    } catch (error) {
      const state = this.getState(serviceName);
      if (state?.state === 'open') {
        this.logger.error(
          `Circuit breaker is OPEN for ${serviceName} - failing fast`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      throw error;
    }
  }

  /**
   * Get current state of a circuit breaker
   */
  getState(serviceName: string): CircuitBreakerState | undefined {
    return this.states.get(serviceName);
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): Record<string, CircuitState> {
    const result: Record<string, CircuitState> = {};
    this.states.forEach((state, service) => {
      result[service] = state.state;
    });
    return result;
  }

  /**
   * Get detailed stats for all circuit breakers
   */
  getDetailedStats(): CircuitBreakerState[] {
    return Array.from(this.states.values());
  }

  /**
   * Manually reset a circuit breaker (for testing/admin purposes)
   */
  reset(serviceName: string): void {
    const state = this.states.get(serviceName);
    if (state) {
      state.state = 'closed';
      state.failureCount = 0;
      state.successCount = 0;
      state.lastStateChange = new Date();
      this.updateMetric(serviceName, 'closed');
      this.logger.log(`Circuit breaker manually reset: ${serviceName}`);
    }
  }
}
