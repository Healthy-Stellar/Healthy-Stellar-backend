import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

export const ReconciliationDiscrepanciesCounter = makeCounterProvider({
  name: 'medchain_reconciliation_discrepancies_total',
  help: 'Total number of reconciliation discrepancies found',
  labelNames: ['type'], // 'failed' | 'missing'
});
