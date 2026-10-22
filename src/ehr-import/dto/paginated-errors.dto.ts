export class PaginatedErrorsDto {
  data: Array<{ rowIndex: number; errorMessage: string; sourceRow: string }>;
  total: number;
  page: number;
  limit: number;
}
