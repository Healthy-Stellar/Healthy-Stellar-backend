/**
 * Tests for the withDisconnectCleanup iterator wrapper.
 *
 * We inline the function under test so we can exercise it in pure Node.js
 * without spinning up a full NestJS / GraphQL module.
 */

import { EventEmitter } from 'events';

// ── Inline the function under test (mirrors subscriptions.resolver.ts) ────────

async function* withDisconnectCleanup<T>(
  iterator: AsyncIterator<T>,
  ctx: { socket?: EventEmitter },
  gauge: { inc: () => void; dec: () => void },
): AsyncGenerator<T> {
  gauge.inc();

  let disconnected = false;
  const disconnectHandler = () => {
    disconnected = true;
    iterator.return?.();
  };

  const socket = ctx.socket;
  socket?.once('close', disconnectHandler);

  try {
    while (true) {
      if (disconnected) return;
      const { value, done } = await iterator.next();
      if (done) return;
      yield value;
    }
  } finally {
    socket?.removeListener('close', disconnectHandler);
    iterator.return?.();
    gauge.dec();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function arrayIterator<T>(values: T[]): AsyncIterator<T> & { returnCalled: boolean } {
  let index = 0;
  let done = false;
  return {
    returnCalled: false,
    async next() {
      if (done || index >= values.length) return { value: undefined as any, done: true };
      return { value: values[index++], done: false };
    },
    async return() {
      done = true;
      (this as any).returnCalled = true;
      return { value: undefined as any, done: true };
    },
  };
}

function hangingIterator(): AsyncIterator<never> & { returnCalled: boolean; resolve: () => void } {
  let _resolve!: () => void;
  let done = false;
  const pending = new Promise<void>((r) => { _resolve = r; });
  return {
    returnCalled: false,
    resolve() { _resolve(); },
    async next() {
      if (done) return { value: undefined as any, done: true };
      await pending;
      return { value: undefined as any, done: true };
    },
    async return() {
      done = true;
      (this as any).returnCalled = true;
      _resolve?.();
      return { value: undefined as any, done: true };
    },
  };
}

function makeGauge() {
  let value = 0;
  return {
    inc: jest.fn(() => { value++; }),
    dec: jest.fn(() => { value--; }),
    get value() { return value; },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('withDisconnectCleanup', () => {
  it('increments gauge on start and decrements on normal completion', async () => {
    const gauge = makeGauge();
    const iter = arrayIterator([1, 2, 3]);
    const socket = new EventEmitter();
    const gen = withDisconnectCleanup(iter, { socket }, gauge);

    await gen.next();
    expect(gauge.inc).toHaveBeenCalledTimes(1);

    await gen.next();
    await gen.next();
    await gen.next(); // done

    expect(gauge.dec).toHaveBeenCalledTimes(1);
    expect(gauge.value).toBe(0);
  });

  it('calls iterator.return() and decrements gauge when socket emits close', async () => {
    const gauge = makeGauge();
    const iter = hangingIterator();
    const socket = new EventEmitter();

    const gen = withDisconnectCleanup(iter, { socket }, gauge);
    const nextPromise = gen.next();

    socket.emit('close');

    const result = await nextPromise;
    expect(result.done).toBe(true);
    expect(iter.returnCalled).toBe(true);
    expect(gauge.dec).toHaveBeenCalledTimes(1);
    expect(gauge.value).toBe(0);
  });

  it('removes the close listener after the generator finishes', async () => {
    const gauge = makeGauge();
    const iter = arrayIterator([42]);
    const socket = new EventEmitter();

    const gen = withDisconnectCleanup(iter, { socket }, gauge);
    await gen.next();
    await gen.next(); // done

    expect(socket.listenerCount('close')).toBe(0);
  });

  it('calls iterator.return() and decrements gauge when generator is explicitly returned', async () => {
    const gauge = makeGauge();
    const iter = hangingIterator();
    const socket = new EventEmitter();

    const gen = withDisconnectCleanup(iter, { socket }, gauge);
    const nextPromise = gen.next();

    gen.return(undefined as any);
    iter.resolve();

    await nextPromise;
    expect(gauge.dec).toHaveBeenCalledTimes(1);
    expect(gauge.value).toBe(0);
  });

  it('works without a socket (no crash when ctx.socket is undefined)', async () => {
    const gauge = makeGauge();
    const iter = arrayIterator([1]);
    const gen = withDisconnectCleanup(iter, {}, gauge);

    const result = await gen.next();
    expect(result.value).toBe(1);
    await gen.next(); // done

    expect(gauge.value).toBe(0);
  });

  describe('load: 500 concurrent subscriptions dropped simultaneously', () => {
    it('leaves zero lingering listeners and zero gauge after all sockets close', async () => {
      const N = 500;
      const gauge = makeGauge();
      const sockets: EventEmitter[] = [];
      const iters: ReturnType<typeof hangingIterator>[] = [];
      const gens: AsyncGenerator<never>[] = [];

      for (let i = 0; i < N; i++) {
        const socket = new EventEmitter();
        const iter = hangingIterator();
        sockets.push(socket);
        iters.push(iter);
        gens.push(withDisconnectCleanup(iter, { socket }, gauge));
      }

      // Start consuming – all will hang waiting for their iterators
      const nextPromises = gens.map((g) => g.next());

      // Drop all 500 simultaneously
      sockets.forEach((s) => s.emit('close'));

      await Promise.all(nextPromises);

      // Zero lingering 'close' listeners
      const totalListeners = sockets.reduce((sum, s) => sum + s.listenerCount('close'), 0);
      expect(totalListeners).toBe(0);

      // All underlying iterators terminated
      const unreturnedCount = iters.filter((it) => !it.returnCalled).length;
      expect(unreturnedCount).toBe(0);

      // Gauge back to zero
      expect(gauge.value).toBe(0);
    }, 10_000);
  });
});
