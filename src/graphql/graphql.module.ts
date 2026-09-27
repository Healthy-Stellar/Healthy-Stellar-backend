import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PubSub } from 'graphql-subscriptions';
import { join } from 'path';
import depthLimit from 'graphql-depth-limit';
import { GraphQLError } from 'graphql';


import { Patient } from '../patients/entities/patient.entity';
import { Record } from '../records/entities/record.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { User } from '../auth/entities/user.entity';

import { RecordsModule } from '../records/records.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { UsersModule } from '../users/users.module';
import { PatientModule } from '../patients/patients.module';

import { GqlAuthGuard, GqlRolesGuard } from './guards/gql-auth.guard';
import { DataLoaderService } from './dataloaders/dataloader.service';
import { UserDataLoader } from './dataloaders/user.dataloader';
import { RecordDataLoader } from './dataloaders/record.dataloader';
import { MedicalRecordResolver } from './resolvers/medical-record.resolver';
import { PatientResolver } from './resolvers/patient.resolver';
import { RecordsResolver } from './resolvers/records.resolver';
import { AccessGrantsResolver } from './resolvers/access-grants.resolver';
import { UsersResolver } from './resolvers/users.resolver';
import { AuditLogsResolver } from './resolvers/audit-logs.resolver';
import { TenantsResolver } from './resolvers/tenants.resolver';
import { RealtimeEventsResolver } from './resolvers/realtime-events.resolver';
import {
  QueryResolver,
  MedicalRecordFieldResolver,
  AccessGrantFieldResolver,
  AuditLogFieldResolver,
} from './resolvers/query.resolver';
import { MutationResolver } from './resolvers/mutation.resolver';
import { PUB_SUB } from './resolvers/subscriptions.resolver';
import { RecordEventsResolver } from './subscriptions/record-events.resolver';

// Services from other modules
import { AuthModule } from '../auth/auth.module';
import { AuthTokenService } from '../auth/services/auth-token.service';
import { SessionManagementService } from '../auth/services/session-management.service';
import { PubSubModule } from '../pubsub/pubsub.module';
import { GraphqlPubSubService } from '../pubsub/services/graphql-pubsub.service';
import { AuditModule } from '../common/audit/audit.module';
import { AuditLogService } from '../common/services/audit-log.service';
import { IdempotencyService } from './services/idempotency.service';
import { ComplexityPlugin } from './plugins/complexity.plugin';
import { ApqPlugin } from './plugins/apq.plugin';
import { ApqService } from './services/apq.service';
import { IdempotencyEntity } from './entities/idempotency.entity';
import { GdprModule } from '../gdpr/gdpr.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, Record, AccessGrant, User, IdempotencyEntity]),
    RecordsModule,
    AccessControlModule,
    UsersModule,
    PatientModule,
    AuthModule,
    PubSubModule,
    AuditModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule, AuthModule, PubSubModule, AuditModule],
      inject: [ConfigService, AuthTokenService, SessionManagementService, GraphqlPubSubService, AuditLogService],
      useFactory: (
        config: ConfigService,
        authTokenService: AuthTokenService,
        sessionManagementService: SessionManagementService,
        graphqlPubSubService: GraphqlPubSubService,
        auditLogService: AuditLogService,
      ) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        return {
          autoSchemaFile: join(process.cwd(), 'docs/schema.graphql'),
          sortSchema: true,
          playground: !isProd,
          introspection: !isProd,

          // Depth limit enforcement (DoS protection), validation-rule level:
          // this runs during GraphQL's validation phase, before the
          // operation is even resolved, so a rejected query never reaches a
          // resolver. The env-configured value here is the hard,
          // environment-wide ceiling; per-tenant tightening of both depth
          // and complexity limits, plus the per-field complexity budget
          // itself, are enforced by ComplexityPlugin (see
          // ./plugins/complexity.plugin.ts), which is auto-registered via
          // its `@Plugin()` decorator + inclusion in `providers` below.
          validationRules: [depthLimit(Number(process.env.GRAPHQL_MAX_QUERY_DEPTH ?? 7))],

          // graphql-ws (recommended transport) for GraphQL subscriptions
          subscriptions: {
            'graphql-ws': {
              keepAlive: 10_000,
              onConnect: async (ctx: any) => {
                const clientIp = ctx.extra?.clientIp || ctx.extra?.request?.ip || 'unknown';

                try {
                  const token = extractWsToken(ctx.connectionParams);
                  if (!token) {
                    await auditLogService.log({
                      entityType: 'GraphQLSubscription',
                      entityId: 'unknown',
                      action: 'CONNECTION_FAILED',
                      userId: 'anonymous',
                      changes: { reason: 'missing_token' },
                      metadata: {
                        clientIp,
                        reason: 'Unauthorized: missing token',
                      },
                    });
                    throw new GraphQLError('Unauthorized: missing token', {
                      extensions: { code: 'UNAUTHENTICATED' },
                    });
                  }

                  const payload = authTokenService.verifyAccessToken(token);
                  if (!payload) {
                    await auditLogService.log({
                      entityType: 'GraphQLSubscription',
                      entityId: 'unknown',
                      action: 'CONNECTION_FAILED',
                      userId: 'anonymous',
                      changes: { reason: 'invalid_token' },
                      metadata: {
                        clientIp,
                        reason: 'Unauthorized: invalid token',
                      },
                    });
                    throw new GraphQLError('Unauthorized: invalid token', {
                      extensions: { code: 'UNAUTHENTICATED' },
                    });
                  }

                  const isSessionValid = await sessionManagementService.isSessionValid(payload.sessionId);
                  if (!isSessionValid) {
                    await auditLogService.log({
                      entityType: 'GraphQLSubscription',
                      entityId: payload.userId,
                      action: 'CONNECTION_FAILED',
                      userId: payload.userId,
                      changes: { reason: 'session_expired' },
                      metadata: {
                        clientIp,
                        reason: 'Session expired or revoked',
                      },
                    });
                    throw new GraphQLError('Session expired or revoked', {
                      extensions: { code: 'UNAUTHENTICATED' },
                    });
                  }

                  await sessionManagementService.updateSessionActivity(payload.sessionId);

                  const connectionId = graphqlPubSubService.generateConnectionId();
                  try {
                    await graphqlPubSubService.registerConnection(payload.userId, connectionId);
                  } catch (error) {
                    await auditLogService.log({
                      entityType: 'GraphQLSubscription',
                      entityId: payload.userId,
                    

/* … truncated 3355 chars — edit only what you need near the top … */
