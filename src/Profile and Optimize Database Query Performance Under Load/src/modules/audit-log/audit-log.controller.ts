import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  Param,
} from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";
import { AuditLog } from "./entities/audit-log.entity";

@Controller("audit-logs")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Post()
  async create(@Body() data: Partial<AuditLog>): Promise<AuditLog> {
    return this.auditLogService.create(data);
  }

  @Get("user/:userId")
  async getByUserId(
    @Param("userId") userId: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
  ) {
    return this.auditLogService.findByUserId(userId, page, limit);
  }

  @Get("date-range")
  async getByDateRange(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("limit") limit: number = 100,
  ) {
    return this.auditLogService.findByDateRange(
      new Date(startDate),
      new Date(endDate),
      limit,
    );
  }

  @Get("filter")
  async getWithFilters(
    @Query("userId") userId?: string,
    @Query("action") action?: string,
    @Query("resourceType") resourceType?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
  ) {
    return this.auditLogService.findWithFilters({
      userId,
      action,
      resourceType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
    });
  }
}
