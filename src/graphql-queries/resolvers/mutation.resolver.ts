import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards, Logger, ValidationPipe } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import {
  UploadRecordInput,
  GrantAccessInput,
  UpdateProfileInput,
  RegisterDeviceInput,
} from '../inputs';
import {
  UploadRecordPayload,
  UploadRecordSuccess,
  AccessGrantPayload,
  AccessGrantSuccess,
  RevokeAccessPayload,
  RevokeAccessSuccess,
  UpdateProfilePayload,
  UpdateProfileSuccess,
  RegisterDevicePayload,
  RegisterDeviceSuccess,
  GdprRequestPayload,
  GdprRequestSuccess,
  ValidationError,
  UnauthorizedError,
  StellarTransactionError,
  NotFoundError,
} from '../types/payload.types';
import { GdprRequestType, JobStatus, UserRole } from '../enums';
import { GqlAuthGuard, CurrentUser, Roles, GqlRolesGuard } from '../guards/gql-auth.guard';
import { IdempotencyService } from '../services/idempotency.service';

import { MedicalRecordsService } from '../../records/services/medical-records.service';
import { AccessGrantsService } from '../../records/services/access-grants.service';
import { UsersService } from '../../users/users.service';
import { GdprService } from '../../gdpr/gdpr.service';
import { DevicesService } from '../../devices/devices.service';

type GqlUser = { sub: string; role: UserRole };

@Resolver()
@UseGuards(GqlAuthGuard)
export class MutationResolver {
  private readonly logger = new Logger(MutationResolver.name);

  constructor(
    private readonly recordsService: MedicalRecordsService,
    private readonly grantsService: AccessGrantsService,
    private readonly usersService: UsersService,
    private readonly gdprService: GdprService,
    private readonly devicesService: DevicesService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /* ═══════════════════════════════════════════════════════════ */
  /*                       uploadRecord                          */
  /* ═══════════════════════════════════════════════════════════ */

  @Mutation(() => UploadRecordPayload, {
    description: 'Upload a new medical record. Accepts an optional idempotencyKey for safe retries.',
  })
  async uploadRecord(
    @Args('input', { type: () => UploadRecordInput }, new ValidationPipe({ transform: true }))
    input: UploadRecordInput,
    @CurrentUser() user: GqlUser,
  ): Promise<typeof UploadRecordPayload> {
    try {
      // ── Idempotency check ──────────────────────────────────
      if (input.idempotencyKey) {
        const cached = await this.idempotency.get(
          `upload:${user.sub}:${input.idempotencyKey}`,
        );
        if (cached) {
          this.logger.debug(`Idempotent hit: ${input.idempotencyKey}`);
          return { ...cached, idempotent: true } as UploadRecordSuccess;
        }
      }

      // ── Resolve upload scalar ──────────────────────────────
      const { filename, mimetype, createReadStream } = await input.file;
      const stream = createReadStream();

      // ── Delegate to domain service ─────────────────────────
      const { record, jobId, estimatedCompletionTime } =
        await this.recordsService.upload({
          stream,
          filename,
          mimetype,
          recordType: input.recordType,
          title: input.title,
          description: input.description,
          patientId: input.patientId ?? user.sub,
          uploadedById: user.sub,
          recordDate: input.recordDate,
        });

      const result: UploadRecordSuccess = {
        record: record as any,
        jobId,
        status: JobStatus.QUEUED,
        estimatedCompletionTime,
        idempotent: false,
      };

      // ── Persist idempotency result ─────────────────────────
      if (input.idempotencyKey) {
        await this.idempotency.set(
          `upload:${user.sub}:${input.idempotencyKey}`,
          result as unknown as Record<string, any>,
        );
      }

      return result;
    } catch (err: any) {
      if (err.name === 'StellarError') {
        return { message: err.message, txHash: err.txHash, errorCode: err.code } as StellarTransactionError;
      }
      if (err.name === 'ValidationError') {
        return { message: err.message, fieldErrors: err.fieldErrors } as ValidationError;
      }
      if (err.status === 403) {
        return { message: err.message } as UnauthorizedError;
      }
      throw err;
    }
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*                       grantAccess                           */
  /* ═══════════════════════════════════════════════════════════ */

  @Mutation(() => AccessGrantPayload, {
    description: 'Grant a provider access to a specific medical record',
  })
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @UseGuards(GqlRolesGuard)
  async grantAccess(
    @Args('input', { type: () => GrantAccessInput }, new ValidationPipe({ transform: true }))
    input: GrantAccessInput,
    @CurrentUser() user: GqlUser,
  ): Promise<typeof AccessGrantPayload> {
    try {
      const grant = await this.grantsService.grant(
        input.recordId,
        input.providerId,
        user.sub,
        input.expiresAt,
      );
      return { grant } as AccessGrantSuccess;
    } catch (err: any) {
      if (err.status === 404) return { message: err.message } as NotFoundError;
      if (err.status === 403) return { message: err.message } as UnauthorizedError;
      if (err.name === 'ValidationError')
        return { message: err.message, fieldErrors: err.fieldErrors } as ValidationError;
      throw err;
    }
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*                       revokeAccess                          */
  /* ═══════════════════════════════════════════════════════════ */

  @Mutation(() => RevokeAccessPayload, {
    description: 'Revoke an existing access grant by its ID',
  })
  @Roles(UserRole.PATIENT, UserRole.ADMIN)
  @UseGuards(GqlRolesGuard)
  async revokeAccess(
    @Args('grantId', { type: () => ID }) grantId: string,
    @CurrentUser() user: GqlUser,
  ): Promise<typeof RevokeAccessPayload> {
    try {
      await this.grantsService.revoke(grantId, user.sub, user.role);
      return { grantId, revoked: true } as RevokeAccessSuccess;
    } catch (err: any) {
      if (err.status === 404) return { message: err.message } as NotFoundError;
      if (err.status === 403) return { message: err.message } as UnauthorizedError;
      throw err;
    }
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*                       updateProfile                         */
  /* ═══════════════════════════════════════════════════════════ */

  @Mutation(() => UpdateProfilePayload, {
    description: "Update the authenticated user's profile",
  })
  async updateProfile(
    @Args('input', { type: () => UpdateProfileInput }, new ValidationPipe({ transform: true }))
    input: UpdateProfileInput,
    @CurrentUser() user: GqlUser,
  ): Promise<typeof UpdateProfilePayload> {
    try {
      let avatarUrl: string | undefined;
      if (input.avatar) {
        const { createReadStream, mimetype, filename } = await input.avatar;
        avatarUrl = await this.usersService.uploadAvatar(
          user.sub,
          createReadStream(),
          filename,
          mimetype,
        );
      }

      const updated = await this.usersService.updateProfile(user.sub, {
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        specialty: input.specialty,
        licenseNumber: input.licenseNumber,
        avatarUrl,
      });

      return { user: updated } as UpdateProfileSuccess;
    } catch (err: any) {
      if (err.name === 'ValidationError')
        return { message: err.message, fieldErrors: err.fieldErrors } as ValidationError;
      if (err.status === 403) return { message: err.message } as UnauthorizedError;
      throw err;
    }
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*                       registerDevice                        */
  /* ═══════════════════════════════════════════════════════════ */

  @Mutation(() => RegisterDevicePayload, {
    description: 'Register a push notification device token for the current user',
  })
  async registerDevice(
    @Args('input', { type: () => RegisterDeviceInput }, new ValidationPipe({ transform: true }))
    input: RegisterDeviceInput,
    @CurrentUser() user: GqlUser,
  ): Promise<typeof RegisterDevicePayload> {
    try {
      const device = await this.devicesService.register(user.sub, input);
      return { deviceId: device.id, registered: true } as RegisterDeviceSuccess;
    } catch (err: any) {
      if (err.name === 'ValidationError')
        return { message: err.message, fieldErrors: err.fieldErrors } as ValidationError;
      if (err.status === 403) return { message: err.message } as UnauthorizedError;
      throw err;
    }
  }

  /* ═══════════════════════════════════════════════════════════ */
  /*                       submitGdprRequest                     */
  /* ═══════════════════════════════════════════════════════════ */

  @Mutation(() => GdprRequestPayload, {
    description: 'Submit a GDPR data request. Returns a job ID for async tracking.',
  })
  async submitGdprRequest(
    @Args('type', { type: () => GdprRequestType }) type: GdprRequestType,
    @CurrentUser() user: GqlUser,
  ): Promise<typeof GdprRequestPayload> {
    try {
      const { jobId, estimatedCompletionTime } = await this.gdprService.submitRequest(
        user.sub,
        type,
      );
      return {
        jobId,
        status: JobStatus.QUEUED,
        estimatedCompletionTime,
      } as GdprRequestSuccess;
    } catch (err: any) {
      if (err.status === 403) return { message: err.message } as UnauthorizedError;
      if (err.name === 'ValidationError')
        return { message: err.message, fieldErrors: err.fieldErrors } as ValidationError;
      throw err;
    }
  }
}
