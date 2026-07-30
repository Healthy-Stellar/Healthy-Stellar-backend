# TODO - Pharmacy automated reorder alerts

- [ ] Inspect existing pharmacy inventory + dispensing flow and ensure correct hook point for stock deduction.
- [ ] Add BullMQ queue/job type for `pharmacy-reorder-alert`.
- [ ] Register the queue and create a BullMQ processor to send alerts + enforce suppression.
- [ ] Add suppression persistence (DB entity or Redis-based in unit tests).
- [ ] After each inventory deduction in `PrescriptionService.fillPrescription`, detect threshold crossing (`> reorderLevel` -> `<= reorderLevel`) and enqueue alert job.
- [ ] Implement admin endpoint `GET /pharmacy/reports/reorder` to list all items below threshold.
- [ ] Add unit/integration test that dispenses below threshold and asserts the reorder alert job is queued and repeats suppressed.
- [ ] Run test suite.

