import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PubSub } from 'graphql-subscriptions';
import { join } from 'path';
import depthLimit from 'graphql-depth-limit';
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from 'graphql-query-complexity';
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
import { IdempotencyEntity } from './entities/idempotency.entity';
import { GdprModule } from '../gdpr/gdpr.module';
import { DevicesModule } from '../devices/devices.module';
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
import { IdempotencyService } from './services/idempotency.service';
import { ComplexityPlugin } from './plugins/complexity.plugin';
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

          // Depth limit to prevent malicious deeply nested queries
          validationRules: [depthLimit(7)],
          plugins: [
            {
              async requestDidStart() {
                return {
                  async didResolveOperation(requestContext: any) {
                    const complexity = getComplexity({
                      schema: requestContext.schema,
                      operationName: requestContext.request.operationName,
                      query: requestContext.document,
                      variables: requestContext.request.variables,
                      estimators: [
                        fieldExtensionsEstimator(),
                        simpleEstimator({ defaultComplexity: 1 }),
                      ],
                    });

                    const complexityThreshold = 150;
                    if (complexity > complexityThreshold) {
                      throw new GraphQLError(
                        `Query complexity ${complexity} exceeds maximum allowed complexity of ${complexityThreshold}. ` +
                          `Reduce nested selection depth, page results, or trim requested fields.`,
                        {
                          extensions: {
                            code: 'GRAPHQL_QUERY_COMPLEXITY_EXCEEDED',
                            complexity,
                            threshold: complexityThreshold,
                          },
                        },
                      );
                    }
                  },
                };
              },
            },
          ],

          // graphql-ws (recommended transport) for GraphQL subscriptions
          subscriptions: {
            'graphql-ws': {
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
                      action: 'CONNECTION_FAILED',
                      userId: payload.userId,
                      changes: { reason: 'connection_limit_reached' },
                      metadata: {
                        clientIp,
                        reason: 'Subscription connection limit reached',
                      },
                    });
                    throw new GraphQLError('Forbidden: subscription connection limit reached', {
                      extensions: { code: 'FORBIDDEN' },
                    });
                  }

                  // Log successful connection
                  await auditLogService.log({
                    entityType: 'GraphQLSubscription',
                    entityId: connectionId,
                    action: 'CONNECTED',
                    userId: payload.userId,
                    changes: { connectionId },
                    metadata: {
                      clientIp,
                    },
                  });

                  ctx.extra.user = payload;
                  ctx.extra.connectionId = connectionId;
                  ctx.extra.connectionParams = ctx.connectionParams ?? {};
                } catch (error) {
                  // Re-throw GraphQL errors
                  if (error instanceof GraphQLError) {
                    throw error;
                  }
                  // Wrap other errors
                  throw new GraphQLError('Internal server error', {
                    extensions: { code: 'INTERNAL_ERROR' },
                  });
                }
              },
              onDisconnect: async (ctx: any) => {
                const userId = ctx?.extra?.user?.userId;
                const connectionId = ctx?.extra?.connectionId;
                if (userId && connectionId) {
                  await graphqlPubSubService.unregisterConnection(userId, connectionId);

                  // Log disconnection
                  try {
                    await auditLogService.log({
                      entityType: 'GraphQLSubscription',
                      entityId: connectionId,
                      action: 'DISCONNECTED',
                      userId,
                      changes: { connectionId },
                      metadata: {},
                    });
                  } catch (error) {
                    // Silently fail audit logging to avoid blocking disconnect
                  }
                }
              },
            },
          },

          // Inject per-request DataLoaders into GQL context
          context: ({ req, extra }: { req?: any; extra?: any }) => {
            const request = req ?? extra?.request ?? { headers: {} };
            if (!request.user && extra?.user) {
              request.user = extra.user;
            }

            return {
              req: request,
              user: request.user,
              connectionParams: extra?.connectionParams ?? {},
              // loaders are populated by the DataLoaderService in each resolver
            };
          },
        };
      },
    }),
  ],
  providers: [
    { provide: PUB_SUB, useValue: new PubSub() },
    GqlAuthGuard,
    GqlRolesGuard,
    DataLoaderService,
    UserDataLoader,
    RecordDataLoader,
    MedicalRecordResolver,
    PatientResolver,
    RecordsResolver,
    AccessGrantsResolver,
    UsersResolver,
    AuditLogsResolver,
    TenantsResolver,
    RealtimeEventsResolver,
    RecordEventsResolver,
    QueryResolver,
    MedicalRecordFieldResolver,
    AccessGrantFieldResolver,
    AuditLogFieldResolver,
    MutationResolver,
    IdempotencyService,
    ComplexityPlugin,
  ],
  exports: [GqlAuthGuard, GqlRolesGuard, PUB_SUB],
})
export class GraphqlModule {}

function extractWsToken(connectionParams?: { [key: string]: any }): string | undefined {
  if (!connectionParams || typeof connectionParams !== 'object') {
    return undefined;
  }

  const authHeader =
    connectionParams.authorization ?? connectionParams.Authorization ?? connectionParams.authToken;
  if (typeof authHeader !== 'string') {
    return undefined;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}
