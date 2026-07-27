import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

export const StellarStreamEventsCounter = makeCounterProvider({
  name: 'medchain_stellar_stream_events_processed_total',
  help: 'Total number of Stellar SSE stream events processed',
  labelNames: ['result'], // 'confirmed' | 'failed' | 'skipped' | 'error'
});
