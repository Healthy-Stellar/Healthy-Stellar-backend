import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import depthLimit from 'graphql-depth-limit';
import { graphqlUploadExpress } from 'graphql-upload';
import { gql } from 'graphql-tag';
import { getComplexity, fieldExtensionsEstimator, simpleEstimator } from 'graphql-query-complexity';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLError } from 'graphql';

// NOTE: These are lightweight unit-ish tests that validate the Apollo server
// rejects requests when depth/complexity limits are exceeded.
// They do not require the full NestJS bootstrap.

describe('GraphQL depth + complexity enforcement', () => {
    const MAX_DEPTH = 7;
    const COMPLEXITY_THRESHOLD = 50;

    const typeDefs = `
    type Query {
      a: Level1
    }

    type Level1 { b: Level2 }
    type Level2 { c: Level3 }
    type Level3 { d: Level4 }
    type Level4 { e: Level5 }
    type Level5 { f: Level6 }
    type Level6 { g: Level7 }
    type Level7 { h: String }
  `;

    const resolvers = {
        Query: {
            a: () => ({ b: {} }),
        },
        Level1: { b: () => ({ c: {} }) },
        Level2: { c: () => ({ d: {} }) },
        Level3: { d: () => ({ e: {} }) },
        Level4: { e: () => ({ f: {} }) },
        Level5: { f: () => ({ g: {} }) },
        Level6: { g: () => ({ h: 'ok' }) },
        Level7: { h: () => 'ok' },
    };

    const schema = makeExecutableSchema({ typeDefs, resolvers });

    const server = new ApolloServer({
        schema,
        validationRules: [depthLimit(MAX_DEPTH)],
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
                                estimators: [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: 1 })],
                            });

                            if (complexity > COMPLEXITY_THRESHOLD) {
                                throw new GraphQLError(
                                    `Query complexity ${complexity} exceeds maximum allowed complexity of ${COMPLEXITY_THRESHOLD}.`,
                                    { extensions: { code: 'QUERY_COMPLEXITY_EXCEEDED', complexity, threshold: COMPLEXITY_THRESHOLD } },
                                );
                            }
                        },
                    };
                },
            },
        ],
    });

    it('rejects over-depth query', async () => {
        const query = `
      query OverDepth { a { b { c { d { e { f { g { h } } } } } } } }
    `;

        const result = await server.executeOperation({ query, operationName: 'OverDepth' } as any);
        expect(result.errors?.[0].extensions?.code).toBeDefined();
    });

    it('rejects over-complexity query', async () => {
        // Increase complexity by requesting repeated leaf fields via aliases
        const query = `
      query OverComplexity { a { b { c { d { e { f { g { h a1:h a2:h a3:h a4:h a5:h a6:h a7:h a8:h a9:h a10:h a11:h a12:h } } } } } } } }
    `;

        const result = await server.executeOperation({ query, operationName: 'OverComplexity' } as any);
        expect(result.errors?.[0].extensions?.code).toBe('QUERY_COMPLEXITY_EXCEEDED');
    });
});

