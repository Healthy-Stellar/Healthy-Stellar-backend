import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const connectedClients = new Counter('subscription_connected_clients');
const subscriptionErrors = new Counter('subscription_errors');
const subscriptionMessages = new Counter('subscription_messages_received');
const deliverySuccessRate = new Rate('subscription_delivery_success_rate');
const subscriptionLatency = new Trend('subscription_delivery_latency_ms', true);

const WS_URL = __ENV.SUBSCRIPTION_WS_URL || 'ws://localhost:3000/graphql';
const AUTH_TOKEN = __ENV.SUBSCRIPTION_AUTH_TOKEN || '';
const PATIENT_ID = __ENV.SUBSCRIPTION_PATIENT_ID || '';
const REPLAY_CURSOR = __ENV.SUBSCRIPTION_REPLAY_CURSOR || undefined;

export const options = {
  scenarios: {
    subscriptions: {
      executor: 'constant-vus',
      vus: 1000,
      duration: '60s',
    },
  },
  thresholds: {
    subscription_delivery_latency_ms: ['p(99)<200'],
    subscription_errors: ['count<1'],
    subscription_delivery_success_rate: ['rate>0.999'],
  },
};

export default function () {
  const subscriptionPayload = {
    query: 'subscription RecordUploaded($patientId: ID!) { recordUploaded(patientId: $patientId) { eventId patientId timestamp recordId actorId } }',
    variables: {
      patientId: PATIENT_ID,
    },
  };

  const params = {
    headers: {
      'Sec-WebSocket-Protocol': 'graphql-transport-ws',
    },
  };

  const response = ws.connect(WS_URL, params, (socket) => {
    let connected = false;
    let acked = false;

    socket.on('open', () => {
      connected = true;
      connectedClients.add(1);

      socket.send(
        JSON.stringify({
          type: 'connection_init',
          payload: {
            authorization: AUTH_TOKEN.startsWith('Bearer ') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`,
            lastEventIds: REPLAY_CURSOR
              ? {
                  [`recordUploaded:${PATIENT_ID}`]: REPLAY_CURSOR,
                }
              : {},
          },
        }),
      );
    });

    socket.on('message', (rawMessage) => {
      let message;
      try {
        message = JSON.parse(rawMessage);
      } catch {
        subscriptionErrors.add(1);
        return;
      }

      if (message.type === 'connection_ack') {
        acked = true;
        socket.send(
          JSON.stringify({
            id: `${__VU}-${__ITER}`,
            type: 'subscribe',
            payload: subscriptionPayload,
          }),
        );
        return;
      }

      if (message.type === 'next') {
        const event = message.payload?.data?.recordUploaded;
        if (event?.timestamp) {
          const latencyMs = Date.now() - new Date(event.timestamp).getTime();
          if (!Number.isNaN(latencyMs) && latencyMs >= 0) {
            subscriptionLatency.add(latencyMs);
          }
        }

        subscriptionMessages.add(1);
        deliverySuccessRate.add(true);
        return;
      }

      if (message.type === 'error') {
        subscriptionErrors.add(1);
        deliverySuccessRate.add(false);
      }
    });

    socket.on('error', () => {
      subscriptionErrors.add(1);
      deliverySuccessRate.add(false);
    });

    socket.setTimeout(() => {
      if (!acked) {
        subscriptionErrors.add(1);
        deliverySuccessRate.add(false);
      }

      socket.close();
    }, 60000);

    socket.setInterval(() => {
      socket.send(JSON.stringify({ type: 'ping' }));
    }, 15000);

    socket.on('close', () => {
      if (!connected || !acked) {
        subscriptionErrors.add(1);
        deliverySuccessRate.add(false);
      }
    });
  });

  check(response, {
    'websocket handshake succeeded': (res) => res && res.status === 101,
  });

  sleep(1);
}
