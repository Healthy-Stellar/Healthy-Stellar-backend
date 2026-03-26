import { Plugin } from '@nestjs/apollo';
import { GraphQLRequestContext } from '@apollo/server';
import {
  ApolloServerPlugin,
  GraphQLRequestListener,
} from '@apollo/server';
import {
  separateOperations,
  GraphQLSchema,
} from 'graphql';
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

export const COMPLEXITY_THRESHOLD = 50;

@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  constructor(private readonly gqlSchemaHost: GraphQLSchemaHost) {}

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const { schema } = this.gqlSchemaHost;

    return {
      async didResolveOperation({ request, document }) {
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });

        if (complexity > COMPLEXITY_THRESHOLD) {
          throw new GraphQLError(
            `Query complexity ${complexity} exceeds maximum allowed complexity of ${COMPLEXITY_THRESHOLD}. ` +
              `Consider using filters or reducing nested pagination depth.`,
            { extensions: { code: 'QUERY_COMPLEXITY_EXCEEDED', complexity, threshold: COMPLEXITY_THRESHOLD } },
          );
        }
      },
    };
  }
}
