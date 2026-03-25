import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import depthLimit from 'graphql-depth-limit';

// Entities
import { User } from '../auth/entities/user.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { Record } from '../records/entities/record.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Tenant } from '../tenant/entities/tenant.entity';

// Guards
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { GqlRolesGuard } from './guards/gql-roles.guard';

// DataLoader
import { DataLoaderService } from './dataloaders/dataloader.service';

// Resolvers
import { RecordsResolver } from './resolvers/records.resolver';
import { AccessGrantsResolver } from './resolvers/access-grants.resolver';
import { UsersResolver } from './resolvers/users.resolver';
import { AuditLogsResolver } from './resolvers/audit-logs.resolver';
import { TenantsResolver } from './resolvers/tenants.resolver';

// Services from other modules
import { RecordsModule } from '../records/records.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AccessGrant, Record, AuditLog, Tenant]),
    RecordsModule,
    AccessControlModule,
    AuthModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        return {
          // Code-first: auto-generate schema from decorators
          autoSchemaFile: join(process.cwd(), 'docs/schema.graphql'),
          sortSchema: true,

          // Playground only in non-production
          playground: !isProd,

          // Disable introspection in production
          introspection: !isProd,

          // Depth limit to prevent malicious deeply nested queries
          validationRules: [depthLimit(7)],

          // Inject per-request DataLoaders into GQL context
          context: ({ req }: { req: any }) => ({
            req,
            // loaders are populated by the DataLoaderService in each resolver
          }),
        };
      },
    }),
  ],
  providers: [
    GqlAuthGuard,
    GqlRolesGuard,
    DataLoaderService,
    RecordsResolver,
    AccessGrantsResolver,
    UsersResolver,
    AuditLogsResolver,
    TenantsResolver,
  ],
  exports: [GqlAuthGuard, GqlRolesGuard, DataLoaderService],
})
export class GraphqlModule {}
