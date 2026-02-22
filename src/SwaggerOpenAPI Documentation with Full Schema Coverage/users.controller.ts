// src/users/users.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CreateUserDto,
  UpdateUserDto,
  UserDto,
  UserQueryDto,
} from './dto/user.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ApiEndpoint } from '../common/decorators/api-endpoint.decorator';
import { PaginatedDto } from '../common/dto/paginated.dto';

const PaginatedUserDto = PaginatedDto(UserDto);

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  // ── GET /users ────────────────────────────────────────────────────────────
  @Get()
  @ApiEndpoint({
    summary: 'List all users',
    description:
      'Returns a paginated, filterable list of users. Requires **admin** or **editor** role.',
    operationId: 'listUsers',
    type: PaginatedUserDto,
  })
  findAll(@Query() query: UserQueryDto) {
    return { data: [], page: 1, limit: 20, total: 0, totalPages: 0 };
  }

  // ── GET /users/:id ────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single user by ID',
    description: 'Fetches the full user record for the given UUID.',
    operationId: 'getUser',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User found.',
    type: UserDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Provided ID is not a valid UUID.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No user found with this ID.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Unexpected server error.',
    type: ErrorResponseDto,
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): UserDto {
    return {} as UserDto;
  }

  // ── POST /users ───────────────────────────────────────────────────────────
  @Post()
  @ApiEndpoint({
    summary: 'Create a new user',
    description: 'Creates a new user account. Requires **admin** role.',
    operationId: 'createUser',
    status: HttpStatus.CREATED,
    type: UserDto,
  })
  create(@Body() dto: CreateUserDto): UserDto {
    return {} as UserDto;
  }

  // ── PATCH /users/:id ──────────────────────────────────────────────────────
  @Patch(':id')
  @ApiOperation({
    summary: 'Partially update a user',
    description: 'Updates one or more fields on the user record.',
    operationId: 'updateUser',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Updated.', type: UserDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid UUID or validation error.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    type: ErrorResponseDto,
    description: 'Missing or invalid token.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Unexpected server error.',
    type: ErrorResponseDto,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): UserDto {
    return {} as UserDto;
  }

  // ── DELETE /users/:id ─────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user',
    description:
      'Permanently removes the user and all associated data. **Irreversible.** Requires **admin** role.',
    operationId: 'deleteUser',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Deleted.' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid UUID.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User not found.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Unexpected server error.',
    type: ErrorResponseDto,
  })
  remove(@Param('id', ParseUUIDPipe) id: string): void {}
}
