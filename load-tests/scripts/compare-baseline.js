/**
 * Baseline Comparison Script
 * 
 * Compares current test results with baseline to detect performance regressions
 */

const fs = require('fs');
const path = require('path');

// Configuration
const TOLERANCE = parseFloat(process.env.TOLERANCE || '0.20'); // 20% tolerance
const BASELINE_DIR = path.join(__dirname, '../baselines');
const RESULTS_DIR = path.join(__dirname, '../results');

/**
 * Load JSON file
 */
function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract key metrics from k6 results
 */
function extractMetrics(data) {
  const metrics = {};

  if (data.metrics && data.metrics.http_req_duration) {
    const duration = data.metrics.http_req_duration.values;
    metrics.http_req_duration = {
      avg: duration.avg,
      p95: duration['p(95)'],
      p99: duration['p(99)'],
      max: duration.max,
    };
  }

  if (data.metrics && data.metrics.http_req_failed) {
    metrics.http_req_failed_rate = data.metrics.http_req_failed.values.rate;
  }

  // Extract scenario-specific metrics
  const scenarios = ['auth', 'record_upload', 'record_fetch', 'access_grant'];
  
  for (const scenario of scenarios) {
    const metricKey = `http_req_duration{scenario:${scenario}}`;
    if (data.metrics && data.metrics[metricKey]) {
      const duration = data.metrics[metricKey].values;
      metrics[scenario] = {
        avg: duration.avg,
        p95: duration['p(95)'],
        p99: duration['p(99)'],
      };
    }
  }

  return metrics;
}

/**
 * Compare metrics and detect regressions
 */
function compareMetrics(current, baseline, tolerance) {
  const regressions = [];
  const improvements = [];
  const stable = [];

  // Compare HTTP request duration
  if (current.http_req_duration && baseline.http_req_duration) {
    const metrics = ['avg', 'p95', 'p99'];
    
    for (const metric of metrics) {
      const currentValue = current.http_req_duration[metric];
      const baselineValue = baseline.http_req_duration[metric];
      const threshold = baselineValue * (1 + tolerance);
      const improvementThreshold = baselineValue * (1 - tolerance);
      const change = ((currentValue - baselineValue) / baselineValue * 100);

      if (currentValue > threshold) {
        regressions.push({
          metric: `http_req_duration.${metric}`,
          current: currentValue.toFixed(2),
          baseline: baselineValue.toFixed(2),
          threshold: threshold.toFixed(2),
          change: change.toFixed(2) + '%',
          severity: change > 50 ? 'critical' : change > 30 ? 'high' : 'medium',
        });
      } else if (currentValue < improvementThreshold) {
        improvements.push({
          metric: `http_req_duration.${metric}`,
          current: currentValue.toFixed(2),
          baseline: baselineValue.toFixed(2),
          change: change.toFixed(2) + '%',
        });
      } else {
        stable.push({
          metric: `http_req_duration.${metric}`,
          current: currentValue.toFixed(2),
          baseline: baselineValue.toFixed(2),
          change: change.toFixed(2) + '%',
        });
      }
    }
  }

  // Compare failure rate
  if (current.http_req_failed_rate !== undefined && baseline.http_req_failed_rate !== undefined) {
    const currentRate = current.http_req_failed_rate * 100;
    const baselineRate = baseline.http_req_failed_rate * 100;
    const change = currentRate - baselineRate;

    if (change > 1) { // More than 1% increase in failure rate
      regressions.push({
        metric: 'http_req_failed_rate',
        current: currentRate.toFixed(2) + '%',
        baseline: baselineRate.toFixed(2) + '%',
        change: '+' + change.toFixed(2) + '%',
        severity: 'critical',
      });
    }
  }

  // Compare scenario-specific metrics
  const scenarios = ['auth', 'record_upload', 'record_fetch', 'access_grant'];
  
  for (const scenario of scenarios) {
    if (current[scenario] && baseline[scenario]) {
      const currentP95 = current[scenario].p95;
      const baselineP95 = baseline[scenario].p95;
      const threshold = baselineP95 * (1 + tolerance);
      const change = ((currentP95 - baselineP95) / baselineP95 * 100);

      if (currentP95 > threshold) {
        regressions.push({
          metric: `${scenario}.p95`,
          current: currentP95.toFixed(2),
          baseline: baselineP95.toFixed(2),
          threshold: threshold.toFixed(2),
          change: change.toFixed(2) + '%',
          severity: change > 50 ? 'critical' : change > 30 ? 'high' : 'medium',
        });
      }
    }
  }

  return { regressions, improvements, stable };
}

/**
 * Generate comparison report
 */
function generateReport(comparison, testType) {
  let report = '\n';
  report += '╔════════════════════════════════════════════════════════════╗\n';
  report += '║           Performance Baseline Comparison                 ║\n';
  report += '╚════════════════════════════════════════════════════════════╝\n\n';

  report += `Test Type: ${testType}\n`;
  report += `Tolerance: ${(TOLERANCE * 100).toFixed(0)}%\n`;
  report += `Date: ${new Date().toISOString()}\n\n`;

  // Regressions
  if (comparison.regressions.length > 0) {
    report += '⚠️  PERFORMANCE REGRESSIONS DETECTED\n';
    report += '─────────────────────────────────────────────────────────────\n';
    
    for (const regression of comparison.regressions) {
      const icon = regression.severity === 'critical' ? '🔴' : 
                   regression.severity === 'high' ? '🟠' : '🟡';
      report += `${icon} ${regression.metric}\n`;
      report += `   Current:  ${regression.current}ms\n`;
      report += `   Baseline: ${regression.baseline}ms\n`;
      if (regression.threshold) {
        report += `   Threshold: ${regression.threshold}ms\n`;
      }
      report += `   Change:   ${regression.change}\n`;
      report += `   Severity: ${regression.severity}\n\n`;
    }
  } else {
    report += '✅ NO PERFORMANCE REGRESSIONS DETECTED\n\n';
  }

  // Improvements
  if (comparison.improvements.length > 0) {
    report += '🎉 PERFORMANCE IMPROVEMENTS\n';
    report += '─────────────────────────────────────────────────────────────\n';
    
    for (const improvement of comparison.improvements) {
      report += `✨ ${improvement.metric}\n`;
      report += `   Current:  ${improvement.current}ms\n`;
      report += `   Baseline: ${improvement.baseline}ms\n`;
      report += `   Change:   ${improvement.change}\n\n`;
    }
  }

  // Stable metrics
  if (comparison.stable.length > 0) {
    report += '📊 STABLE METRICS\n';
    report += '─────────────────────────────────────────────────────────────\n';
    
    for (const stable of comparison.stable) {
      report += `✓ ${stable.metric}: ${stable.current}ms (${stable.change})\n`;
    }
    report += '\n';
  }

  report += '═════════════════════════════════════════════════════════════\n\n';

  return report;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node compare-baseline.js <test-type> <current-results-file>');
    console.error('Example: node compare-baseline.js load comprehensive-load-latest.json');
    process.exit(1);
  }

  const testType = args[0];
  const currentFile = args[1];

  // Load baseline
  const baselinePath = path.join(BASELINE_DIR, `${testType}-baseline.json`);
  const baseline = loadJSON(baselinePath);

  if (!baseline) {
    console.error(`Baseline not found: ${baselinePath}`);
    console.error('Run: npm run load-test:baseline to create baseline');
    process.exit(1);
  }

  // Load current results
  const currentPath = path.join(RESULTS_DIR, currentFile);
  const current = loadJSON(currentPath);

  if (!current) {
    console.error(`Current results not found: ${currentPath}`);
    process.exit(1);
  }

  // Extract metrics
  const baselineMetrics = extractMetrics(baseline);
  const currentMetrics = extractMetrics(current);

  // Compare
  const comparison = compareMetrics(currentMetrics, baselineMetrics, TOLERANCE);

  // Generate report
  const report = generateReport(comparison, testType);
  console.log(report);

  // Save report
  const reportPath = path.join(RESULTS_DIR, `comparison-${testType}-${Date.now()}.txt`);
  fs.writeFileSync(reportPath, report);
  console.log(`Report saved to: ${reportPath}`);

  // Exit with error if regressions detected
  if (comparison.regressions.length > 0) {
    console.error('\n❌ Performance regression detected!');
    process.exit(1);
  } else {
    console.log('\n✅ Performance is within acceptable range');
    process.exit(0);
  }
}

// Run
main();
