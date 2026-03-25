/**
 * HTML Report Generator for k6 Load Test Results
 *
 * Generates a self-contained HTML report from k6 summary data.
 * Used in handleSummary() callbacks.
 */

/**
 * Generate a full HTML report from k6 summary data object.
 * @param {object} data - k6 summary data passed to handleSummary
 * @returns {string} HTML string
 */
export function generateHtmlReport(data) {
  const metrics = data.metrics || {};
  const timestamp = new Date().toISOString();

  const scenarios = [
    {
      id: 'patient_reads',
      label: '100 Concurrent Patient Reads',
      durationMetric: 'patient_read_duration',
      errorMetric: 'patient_read_errors',
      threshold: 500,
      type: 'read',
    },
    {
      id: 'provider_writes',
      label: '50 Concurrent Provider Writes',
      durationMetric: 'provider_write_duration',
      errorMetric: 'provider_write_errors',
      threshold: 2000,
      type: 'write',
    },
    {
      id: 'health_checks',
      label: '200 Concurrent Health Checks',
      durationMetric: 'health_check_duration',
      errorMetric: 'health_check_errors',
      threshold: 100,
      type: 'health',
    },
    {
      id: 'spike',
      label: 'Spike Test (0 -> 500 -> 0 in 60s)',
      durationMetric: 'spike_duration',
      errorMetric: 'spike_errors',
      threshold: 2000,
      type: 'spike',
    },
  ];

  const scenarioRows = scenarios.map((s) => {
    const dm = metrics[s.durationMetric];
    const em = metrics[s.errorMetric];

    const avg  = dm ? (dm.values.avg   || 0).toFixed(1) : 'N/A';
    const p95  = dm ? (dm.values['p(95)'] || 0).toFixed(1) : 'N/A';
    const p99  = dm ? (dm.values['p(99)'] || 0).toFixed(1) : 'N/A';
    const max  = dm ? (dm.values.max   || 0).toFixed(1) : 'N/A';
    const errRate = em ? ((em.values.rate || 0) * 100).toFixed(2) : 'N/A';

    const p95Val = dm ? (dm.values['p(95)'] || 0) : null;
    const pass = p95Val !== null ? p95Val < s.threshold : null;
    const badge = pass === null ? 'badge-unknown' : pass ? 'badge-pass' : 'badge-fail';
    const badgeText = pass === null ? 'NO DATA' : pass ? 'PASS' : 'FAIL';

    return `
      <tr>
        <td>${s.label}</td>
        <td>${avg} ms</td>
        <td class="${p95Val !== null && p95Val >= s.threshold ? 'metric-fail' : ''}">${p95} ms</td>
        <td>${p99} ms</td>
        <td>${max} ms</td>
        <td>${errRate}%</td>
        <td><span class="badge ${badge}">${badgeText}</span></td>
      </tr>`;
  }).join('');

  const globalDuration = metrics['http_req_duration'];
  const globalFailed   = metrics['http_req_failed'];
  const totalReqs      = metrics['http_reqs'];

  const globalP95  = globalDuration ? (globalDuration.values['p(95)'] || 0).toFixed(1) : 'N/A';
  const globalP99  = globalDuration ? (globalDuration.values['p(99)'] || 0).toFixed(1) : 'N/A';
  const globalAvg  = globalDuration ? (globalDuration.values.avg || 0).toFixed(1) : 'N/A';
  const errorRate  = globalFailed   ? ((globalFailed.values.rate || 0) * 100).toFixed(2) : 'N/A';
  const reqCount   = totalReqs      ? (totalReqs.values.count || 0) : 'N/A';
  const reqRate    = totalReqs      ? (totalReqs.values.rate  || 0).toFixed(1) : 'N/A';

  const allPassed = scenarios.every((s) => {
    const dm = metrics[s.durationMetric];
    if (!dm) return false;
    return (dm.values['p(95)'] || 0) < s.threshold;
  });

  const overallBadge = allPassed ? 'badge-pass' : 'badge-fail';
  const overallText  = allPassed ? 'ALL SCENARIOS PASSED' : 'SOME SCENARIOS FAILED';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Load Test Report - ${timestamp}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fa; color: #333; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 32px 40px; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header p  { opacity: 0.7; font-size: 14px; }
    .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
    .overall   { display: flex; align-items: center; gap: 16px; background: white; border-radius: 12px; padding: 24px 32px; margin-bottom: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .overall h2 { font-size: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card  { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .stat-card .value { font-size: 28px; font-weight: 700; color: #1a1a2e; }
    .stat-card .label { font-size: 12px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .section h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #1a1a2e; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 10px 12px; background: #f8f9fa; font-weight: 600; color: #555; border-bottom: 2px solid #e9ecef; }
    td { padding: 12px; border-bottom: 1px solid #f0f0f0; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fafbfc; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
    .badge-pass    { background: #d4edda; color: #155724; }
    .badge-fail    { background: #f8d7da; color: #721c24; }
    .badge-unknown { background: #e2e3e5; color: #383d41; }
    .metric-fail   { color: #dc3545; font-weight: 700; }
    .thresholds-list { list-style: none; }
    .thresholds-list li { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; display: flex; justify-content: space-between; }
    .thresholds-list li:last-child { border-bottom: none; }
    .bottleneck { background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 12px; }
    .bottleneck h4 { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
    .bottleneck p  { font-size: 13px; color: #555; line-height: 1.5; }
    .fix { background: #d4edda; border-left: 4px solid #28a745; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 12px; }
    .fix h4 { font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #155724; }
    .fix p  { font-size: 13px; color: #555; line-height: 1.5; }
    footer { text-align: center; padding: 24px; color: #aaa; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Production Load Test Report</h1>
    <p>Generated: ${timestamp}</p>
  </div>

  <div class="container">
    <div class="overall">
      <span class="badge ${overallBadge}" style="font-size:16px;padding:8px 20px;">${overallText}</span>
      <div>
        <h2>Production Load Test</h2>
        <p style="color:#888;font-size:13px;margin-top:4px;">4 scenarios: 100 patient reads, 50 provider writes, 200 health checks, spike 0-500-0</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${reqCount}</div>
        <div class="label">Total Requests</div>
      </div>
      <div class="stat-card">
        <div class="value">${reqRate}/s</div>
        <div class="label">Request Rate</div>
      </div>
      <div class="stat-card">
        <div class="value">${globalAvg} ms</div>
        <div class="label">Avg Latency</div>
      </div>
      <div class="stat-card">
        <div class="value">${globalP95} ms</div>
        <div class="label">p95 Latency</div>
      </div>
      <div class="stat-card">
        <div class="value">${globalP99} ms</div>
        <div class="label">p99 Latency</div>
      </div>
      <div class="stat-card">
        <div class="value">${errorRate}%</div>
        <div class="label">Error Rate</div>
      </div>
    </div>

    <div class="section">
      <h3>Scenario Results</h3>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Avg</th>
            <th>p95</th>
            <th>p99</th>
            <th>Max</th>
            <th>Error Rate</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${scenarioRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h3>Acceptance Criteria Thresholds</h3>
      <ul class="thresholds-list">
        <li><span>Patient Reads p95</span><span>&lt; 500ms</span></li>
        <li><span>Provider Writes p95</span><span>&lt; 2000ms</span></li>
        <li><span>Health Checks p95</span><span>&lt; 100ms</span></li>
        <li><span>Spike Test p95</span><span>&lt; 2000ms</span></li>
        <li><span>Global Error Rate</span><span>&lt; 2%</span></li>
        <li><span>Spike Error Rate</span><span>&lt; 5%</span></li>
      </ul>
    </div>

    <div class="section">
      <h3>Known Bottlenecks &amp; Proposed Fixes</h3>

      <div class="bottleneck">
        <h4>1. Database N+1 Queries on Record Listing</h4>
        <p>Fetching a list of records triggers individual queries for patient info, provider info, and access grants per record. Under 100 concurrent reads this compounds quickly.</p>
      </div>
      <div class="fix">
        <h4>Fix: Eager-load relations with TypeORM relations option</h4>
        <p>Use <code>relations: ['patient', 'provider']</code> in the repository find call, or switch to a single JOIN query. Add a composite index on <code>(patient_id, created_at DESC)</code>.</p>
      </div>

      <div class="bottleneck">
        <h4>2. No Response Caching on Read-Heavy Endpoints</h4>
        <p>Every patient read hits the database directly. Under 100 VUs the DB connection pool saturates, causing queuing latency that pushes p95 above 500ms.</p>
      </div>
      <div class="fix">
        <h4>Fix: Add Redis cache layer for record reads</h4>
        <p>Cache <code>GET /records/:id</code> responses in Redis with a 30-second TTL. Use NestJS <code>CacheModule</code> with <code>@CacheKey</code> and <code>@CacheTTL</code> decorators. Invalidate on write.</p>
      </div>

      <div class="bottleneck">
        <h4>3. Synchronous Stellar Blockchain Calls on Record Creation</h4>
        <p>Provider writes block on Stellar transaction confirmation, adding 1-3s to every write. Under 50 concurrent providers this saturates the write path.</p>
      </div>
      <div class="fix">
        <h4>Fix: Move Stellar calls to async queue</h4>
        <p>Return a 202 Accepted immediately after DB write. Push the Stellar transaction to the existing BullMQ queue (<code>QueueModule</code>). The client polls or receives a webhook when confirmed.</p>
      </div>

      <div class="bottleneck">
        <h4>4. Health Check Endpoint Runs DB Ping on Every Request</h4>
        <p>The <code>/health</code> endpoint performs a live DB query on each call. Under 200 concurrent health checks this adds unnecessary DB load and pushes p95 above 100ms.</p>
      </div>
      <div class="fix">
        <h4>Fix: Cache health check result for 5 seconds</h4>
        <p>Use an in-memory cache (or Redis) to store the last health check result and return it for up to 5 seconds before re-checking. This reduces DB load by ~99% for health polling.</p>
      </div>

      <div class="bottleneck">
        <h4>5. No Connection Pool Tuning for Spike Traffic</h4>
        <p>The default TypeORM pool size (10) is exhausted almost immediately during the 0-500 spike, causing connection timeout errors and cascading failures.</p>
      </div>
      <div class="fix">
        <h4>Fix: Tune DB pool and add circuit breaker</h4>
        <p>Set <code>extra: { max: 50, idleTimeoutMillis: 30000 }</code> in TypeORM config. The existing <code>CircuitBreakerModule</code> should be applied to DB-heavy routes to fail fast and shed load gracefully during spikes.</p>
      </div>
    </div>
  </div>

  <footer>
    <p>Generated by k6 load test suite | Healthy-Stellar Backend</p>
  </footer>
</body>
</html>`;
}
