import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PubSub } from 'graphql-subscriptions';
import { join } from 'path';
import depthLimit from 'graphql-depth-limit';
import { GraphQLError } from 'graphql';

import { Patient } from '../patients/entities/patient.entity';
import { Record } from '../records/entities/record.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { User } from '../users/entities/user.entity';

import { RecordsModule } from '../records/records.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { UsersModule } from '../users/users.module';
import { PatientModule } from '../patients/patients.module';

import { GqlAuthGuard, GqlRolesGuard } from './guards/gql-auth.guard';
import { DataLoaderService } from './dataloaders/dataloader.service';
import { PatientResolver } from './resolvers/patient.resolver';
import { RecordsResolver } from './resolvers/records.resolver';
import { AccessGrantsResolver } from './resolvers/access-grants.resolver';
import { UsersResolver } from './resolvers/users.resolver';
import { AuditLogsResolver } from './resolvers/audit-logs.resolver';
import { TenantsResolver } from './resolvers/tenants.resolver';
import { RealtimeEventsResolver } from './resolvers/realtime-events.resolver';

// Services from other modules
import { RecordsModule } from '../records/records.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { AuthModule } from '../auth/auth.module';
import { AuthTokenService } from '../auth/services/auth-token.service';
import { SessionManagementService } from '../auth/services/session-management.service';
import { PubSubModule } from '../pubsub/pubsub.module';
import { GraphqlPubSubService } from '../pubsub/services/graphql-pubsub.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, Record, AccessGrant, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('JWT_SECRET', 'secret'),
        signOptions: { expiresIn: cfg.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
    RecordsModule,
    AccessControlModule,
    AuthModule,
    PubSubModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule, AuthModule, PubSubModule],
      inject: [ConfigService, AuthTokenService, SessionManagementService, GraphqlPubSubService],
      useFactory: (
        config: ConfigService,
        authTokenService: AuthTokenService,
        sessionManagementService: SessionManagementService,
        graphqlPubSubService: GraphqlPubSubService,
      ) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        return {
          autoSchemaFile: join(process.cwd(), 'docs/schema.graphql'),
          sortSchema: true,
          playground: !isProd,
          introspection: !isProd,

          // Depth limit to prevent malicious deeply nested queries
          validationRules: [depthLimit(7)],

          // graphql-ws (recommended transport) for GraphQL subscriptions
          subscriptions: {
            'graphql-ws': {
              onConnect: async (ctx: any) => {
                const token = extractWsToken(ctx.connectionParams);
                if (!token) {
                  throw new GraphQLError('Unauthorized: missing token', {
                    extensions: { code: 'UNAUTHENTICATED' },
                  });
                }

                const payload = authTokenService.verifyAccessToken(token);
                if (!payload) {
                  throw new GraphQLError('Unauthorized: invalid token', {
                    extensions: { code: 'UNAUTHENTICATED' },
                  });
                }

                const isSessionValid = await sessionManagementService.isSessionValid(payload.sessionId);
                if (!isSessionValid) {
                  throw new GraphQLError('Session expired or revoked', {
                    extensions: { code: 'UNAUTHENTICATED' },
                  });
                }

                await sessionManagementService.updateSessionActivity(payload.sessionId);

                const connectionId = graphqlPubSubService.generateConnectionId();
                try {
                  await graphqlPubSubService.registerConnection(payload.userId, connectionId);
                } catch {
                  throw new GraphQLError('Forbidden: subscription connection limit reached', {
                    extensions: { code: 'FORBIDDEN' },
                  });
                }

                ctx.extra.user = payload;
                ctx.extra.connectionId = connectionId;
                ctx.extra.connectionParams = ctx.connectionParams ?? {};
              },
              onDisconnect: async (ctx: any) => {
                const userId = ctx?.extra?.user?.userId;
                const connectionId = ctx?.extra?.connectionId;
                if (userId && connectionId) {
                  await graphqlPubSubService.unregisterConnection(userId, connectionId);
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
    PatientResolver,
    RecordsResolver,
    AccessGrantsResolver,
    UsersResolver,
    AuditLogsResolver,
    TenantsResolver,
    RealtimeEventsResolver,
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
