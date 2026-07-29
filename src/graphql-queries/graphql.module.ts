import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.js';
import depthLimit from 'graphql-depth-limit';

// Resolvers
import {
  QueryResolver,
  MedicalRecordFieldResolver,
  AccessGrantFieldResolver,
  AuditLogFieldResolver,
} from './resolvers/query.resolver';
import { MutationResolver } from './resolvers/mutation.resolver';

// DataLoaders
import { UserDataLoader } from './dataloaders/user.dataloader';
import { RecordDataLoader } from './dataloaders/record.dataloader';

// Services
import { IdempotencyService } from './services/idempotency.service';

// Plugins (reuse the single canonical implementation from src/graphql/ —
// this module previously pointed at a non-existent local ./plugins path)
import { ComplexityPlugin } from '../graphql/plugins/complexity.plugin';

// Guards
import { GqlAuthGuard, GqlRolesGuard } from './guards/gql-auth.guard';

// Entities
import { IdempotencyEntity } from './entities/idempotency.entity';

// Domain modules
import { RecordsModule } from '../records/records.module';
import { UsersModule } from '../users/users.module';
import { GdprModule } from '../gdpr/gdpr.module';
import { DevicesModule } from '../devices/devices.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../common/audit/audit.module';

// Throttling
import { GraphQLSubscriptionLimiter } from '../common/throttler/graphql-subscription-limiter';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (limiter: GraphQLSubscriptionLimiter) => ({
        autoSchemaFile: true,
        sortSchema: true,
        playground: process.env.NODE_ENV !== 'production',
        introspection: process.env.NODE_ENV !== 'production',
        context: ({ req }) => ({ req }),
        uploads: false,

        // Depth limit (DoS protection) — validation-rule level, runs before
        // the operation is resolved. Complexity limiting + per-tenant depth
        // overrides are handled by ComplexityPlugin (registered below via
        // its `@Plugin()` decorator), consistent with src/graphql/graphql.module.ts.
        validationRules: [depthLimit(Number(process.env.GRAPHQL_MAX_QUERY_DEPTH ?? 7))],
        subscriptions: {
          'graphql-ws': {
            onConnect: async (context) => {
              const request = context.extra?.request || context.connectionParams;
              const userId = (context.connectionParams as any)?.userId;
              const tenantId = (context.connectionParams as any)?.tenantId;

              const { allowed, reason } = await limiter.checkLimit({ userId, tenantId });

              if (!allowed) {
                throw new Error(`Subscription rejected: ${reason}`);
              }

              return true;
            },
            onDisconnect: async (context) => {
              const userId = (context.connectionParams as any)?.userId;
              const tenantId = (context.connectionParams as any)?.tenantId;
              await limiter.releaseConnection({ userId, tenantId });
            },
          },
        },
      }),
      inject: [GraphQLSubscriptionLimiter],
    }),

    TypeOrmModule.forFeature([IdempotencyEntity]),

    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),

    RecordsModule,
    UsersModule,
    GdprModule,
    DevicesModule,
    AuthModule,
    AuditModule,
  ],

  providers: [
    // Root resolvers
    QueryResolver,
    MutationResolver,

    // Field resolvers
    MedicalRecordFieldResolver,
    AccessGrantFieldResolver,
    AuditLogFieldResolver,

    // DataLoaders (REQUEST scoped — registered globally via module)
    UserDataLoader,
    RecordDataLoader,

    // Services
    IdempotencyService,
    GraphQLSubscriptionLimiter,

    // Guards
    GqlAuthGuard,
    GqlRolesGuard,

    // Plugins
    ComplexityPlugin,
  ],
})
export class HealthyGraphQLModule {}
