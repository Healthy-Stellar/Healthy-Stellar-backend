/**
 * Manual mock for @nestjs/bullmq.
 * @nestjs/bullmq is not installed; this mock satisfies imports in unit tests.
 */

const getQueueToken = (name) => `BullQueue_${name}`;

const InjectQueue = (name) => () => undefined;

const Processor = (queueName) => (target) => target;

class WorkerHost {
  async process() {}
}

const BullModule = {
  registerQueue: (..._args) => ({ module: class BullQueueModule {}, imports: [], exports: [] }),
  forRoot: (_options) => ({ module: class BullRootModule {}, imports: [], exports: [] }),
};

module.exports = { getQueueToken, InjectQueue, Processor, WorkerHost, BullModule };
