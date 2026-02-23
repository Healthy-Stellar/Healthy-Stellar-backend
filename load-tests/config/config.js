/**
 * k6 Load Testing Configuration
 * 
 * Central configuration for all load tests
 */

export const config = {
  // Base URL for API
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
  
  // Test data
  testUsers: {
    admin: {
      email: __ENV.ADMIN_EMAIL || 'admin@test.com',
      password: __ENV.ADMIN_PASSWORD || 'Admin123!@#',
    },
    doctor: {
      email: __ENV.DOCTOR_EMAIL || 'doctor@test.com',
      password: __ENV.DOCTOR_PASSWORD || 'Doctor123!@#',
    },
  },
  
  // Performance thresholds
  thresholds: {
    // HTTP request duration
    http_req_duration_p95: 500, // 95th percentile < 500ms
    http_req_duration_p99: 1000, // 99th percentile < 1000ms
    
    // HTTP request failure rate
    http_req_failed_rate: 0.01, // < 1% failure rate
    
    // Specific endpoint thresholds
    auth_duration_p95: 300, // Auth should be fast
    record_upload_duration_p95: 2000, // Uploads can be slower
    record_fetch_duration_p95: 200, // Reads should be very fast
    access_grant_duration_p95: 400,
  },
  
  // InfluxDB configuration
  influxdb: {
    url: __ENV.INFLUXDB_URL || 'http://localhost:8086',
    database: __ENV.INFLUXDB_DB || 'k6',
    token: __ENV.INFLUXDB_TOKEN || '',
  },
  
  // Test scenarios configuration
  scenarios: {
    smoke: {
      vus: 1,
      duration: '1m',
    },
    load: {
      stages: [
        { duration: '2m', target: 100 }, // Ramp up
        { duration: '5m', target: 100 }, // Stay at load
        { duration: '2m', target: 0 },   // Ramp down
      ],
    },
    stress: {
      stages: [
        { duration: '2m', target: 100 },  // Ramp up to normal load
        { duration: '5m', target: 100 },  // Stay at normal load
        { duration: '2m', target: 200 },  // Ramp up to stress load
        { duration: '5m', target: 200 },  // Stay at stress load
        { duration: '2m', target: 300 },  // Ramp up to breaking point
        { duration: '5m', target: 300 },  // Stay at breaking point
        { duration: '5m', target: 0 },    // Ramp down
      ],
    },
    soak: {
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '3h', target: 50 },   // Stay at load for extended period
        { duration: '2m', target: 0 },    // Ramp down
      ],
    },
    spike: {
      stages: [
        { duration: '10s', target: 100 }, // Normal load
        { duration: '1m', target: 1000 }, // Spike!
        { duration: '3m', target: 100 },  // Back to normal
        { duration: '10s', target: 0 },   // Ramp down
      ],
    },
  },
  
  // Baseline comparison
  baseline: {
    tolerance: 0.20, // 20% tolerance for performance regression
  },
};

/**
 * Get scenario configuration by name
 */
export function getScenario(name) {
  return config.scenarios[name] || config.scenarios.smoke;
}

/**
 * Get threshold configuration for k6
 */
export function getThresholds() {
  return {
    'http_req_duration': [`p(95)<${config.thresholds.http_req_duration_p95}`],
    'http_req_duration{scenario:auth}': [`p(95)<${config.thresholds.auth_duration_p95}`],
    'http_req_duration{scenario:record_upload}': [`p(95)<${config.thresholds.record_upload_duration_p95}`],
    'http_req_duration{scenario:record_fetch}': [`p(95)<${config.thresholds.record_fetch_duration_p95}`],
    'http_req_duration{scenario:access_grant}': [`p(95)<${config.thresholds.access_grant_duration_p95}`],
    'http_req_failed': [`rate<${config.thresholds.http_req_failed_rate}`],
  };
}

/**
 * Get InfluxDB output configuration
 */
export function getInfluxDBConfig() {
  if (!config.influxdb.url) {
    return null;
  }
  
  return {
    output: 'influxdb',
    options: {
      influxdb: {
        url: config.influxdb.url,
        db: config.influxdb.database,
        token: config.influxdb.token,
      },
    },
  };
}
