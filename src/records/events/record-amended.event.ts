export class RecordAmendedEvent {
  constructor(
    public readonly recordId: string,
    public readonly newVersion: number,
    public readonly newCid: string,
    public readonly amendedBy: string,
    public readonly amendmentReason: string,
    public readonly stellarTxHash: string | null,
    public readonly granteeIds: string[],
  ) {}
}
