import { makeCounterProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';

export const EventListenerUpGauge = makeGaugeProvider({
  name: 'notifications_event_listener_up',
  help: '1 if the on-chain event listener is connected to the Stellar RPC, 0 otherwise',
});

export const MissedEventsTotalCounter = makeCounterProvider({
  name: 'notifications_missed_events_total',
  help: 'Total number of on-chain events missed due to listener disconnection',
});
