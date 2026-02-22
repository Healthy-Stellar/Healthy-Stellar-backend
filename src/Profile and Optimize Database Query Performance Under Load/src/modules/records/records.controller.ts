import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Patch,
} from "@nestjs/common";
import { RecordsService } from "./records.service";
import { Record } from "./entities/record.entity";

@Controller("records")
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post()
  async create(@Body() data: Partial<Record>): Promise<Record> {
    return this.recordsService.create(data);
  }

  @Get("owner/:ownerId")
  async getByOwnerId(
    @Param("ownerId") ownerId: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
  ) {
    return this.recordsService.findByOwnerId(ownerId, page, limit);
  }

  @Get("status/:status")
  async getByStatus(
    @Param("status") status: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
  ) {
    return this.recordsService.findByStatus(status, page, limit);
  }

  @Get("popular")
  async getPopular(@Query("limit") limit: number = 10) {
    return this.recordsService.getPopularRecords(limit);
  }

  @Get("filter")
  async getWithFilters(
    @Query("ownerId") ownerId?: string,
    @Query("status") status?: string,
    @Query("category") category?: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
  ) {
    return this.recordsService.findWithFilters({
      ownerId,
      status,
      category,
      page,
      limit,
    });
  }

  @Patch(":id/view")
  async incrementView(@Param("id") id: string) {
    await this.recordsService.incrementViewCount(id);
    return { success: true };
  }
}
