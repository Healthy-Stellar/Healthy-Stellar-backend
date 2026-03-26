import { ConflictException } from '@nestjs/common';

export class ConcurrencyException extends ConflictException {
  constructor(aggregateId: string, expected: number, actual: number) {
    super(
      `Concurrency conflict on aggregate "${aggregateId}": ` +
        `expected version ${expected} but current version is ${actual}. Retry the operation.`,
    );
  }
}
