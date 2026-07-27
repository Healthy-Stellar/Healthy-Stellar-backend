export class VersionMetaDto {
  id: string;
  recordId: string;
  version: number;
  cid: string;
  stellarTxHash: string | null;
  amendedBy: string;
  amendmentReason: string;
  createdAt: Date;
}

export class PaginatedVersionHistoryDto {
  data: VersionMetaDto[];
  total: number;
  page: number;
  limit: number;
}
