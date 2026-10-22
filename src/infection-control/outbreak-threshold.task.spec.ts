import { Test, TestingModule } from '@nestjs/testing';
import { OutbreakThresholdTask } from './outbreak-threshold.task';
import { OutbreakAlertsService } from './outbreak-alerts.service';

describe('OutbreakThresholdTask', () => {
  let task: OutbreakThresholdTask;
  let outbreakAlertsService: { evaluateAllThresholds: jest.Mock };

  beforeEach(async () => {
    outbreakAlertsService = { evaluateAllThresholds: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutbreakThresholdTask,
        { provide: OutbreakAlertsService, useValue: outbreakAlertsService },
      ],
    }).compile();

    task = module.get(OutbreakThresholdTask);
  });

  it('delegates evaluation of all thresholds to OutbreakAlertsService', async () => {
    await task.evaluateOutbreakThresholds();
    expect(outbreakAlertsService.evaluateAllThresholds).toHaveBeenCalledTimes(1);
  });

  it('completes without throwing when alerts are created', async () => {
    outbreakAlertsService.evaluateAllThresholds.mockResolvedValue([
      { threshold: {}, observedCount: 5, alertCreated: { id: 'a1' } },
    ]);

    await expect(task.evaluateOutbreakThresholds()).resolves.toBeUndefined();
  });
});
