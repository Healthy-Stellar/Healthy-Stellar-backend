import { Plugin } from '@nestjs/apollo';
import { ApolloServerPlugin, GraphQLRequestContext } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { ApqService } from '../services/apq.service';

@Plugin()
export class ApqPlugin implements ApolloServerPlugin {
  constructor(private readonly apqService: ApqService) {}

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const isProd = process.env.NODE_ENV === 'production';
    const apqService = this.apqService;

    return {
      async didResolveOperation(requestContext: GraphQLRequestContext<any>) {
        const request = requestContext.request;
        const persistedQuery = request.extensions?.persistedQuery as
          | { sha256Hash?: string }
          | undefined;

        if (!persistedQuery || !persistedQuery.sha256Hash) {
          if (isProd) {
            throw new GraphQLError(
              'Persisted queries are required in production. All requests must include a persisted query hash in extensions.persistedQuery.sha256Hash.',
              {
                extensions: {
                  code: 'PERSISTED_QUERY_REQUIRED',
                },
              },
            );
          }
          return;
        }

        const { sha256Hash } = persistedQuery;
        const storedQuery = await apqService.getQuery(sha256Hash);

        if (!storedQuery) {
          if (isProd) {
            throw new GraphQLError(
              'Unknown persisted query hash. The query has not been registered in the persisted query store.',
              {
                extensions: {
                  code: 'PERSISTED_QUERY_NOT_FOUND',
                  hash: sha256Hash,
                },
              },
            );
          }
          return;
        }

        if (request.query && request.query !== storedQuery) {
          throw new GraphQLError(
            'Persisted query hash mismatch. The provided query does not match the stored query for this hash.',
            {
              extensions: {
                code: 'PERSISTED_QUERY_MISMATCH',
                hash: sha256Hash,
              },
            },
          );
        }

        request.query = storedQuery;
      },
    };
  }
}
