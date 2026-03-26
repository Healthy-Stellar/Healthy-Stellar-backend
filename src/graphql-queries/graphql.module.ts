import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.js';

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

// Plugins
import { ComplexityPlugin } from './plugins/complexity.plugin';

// Guards
import { GqlAuthGuard, GqlRolesGuard } from './guards/gql-auth.guard';

// Entities
import { IdempotencyEntity } from './entities/idempotency.entity';

// Domain modules
import { RecordsModule } from '../records/records.module';
import { UsersModule } from '../users/users.module';
import { GdprModule } from '../gdpr/gdpr.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req }) => ({ req }),
      /**
       * graphql-upload must be disabled in Apollo config because we
       * handle it via the Express middleware below.
       */
      uploads: false,
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

    // Guards
    GqlAuthGuard,
    GqlRolesGuard,

    // Plugins
    ComplexityPlugin,
  ],
})
export class HealthyGraphQLModule {}
