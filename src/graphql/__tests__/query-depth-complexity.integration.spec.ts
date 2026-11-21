import { ApolloServer } from '@apollo/server';
import depthLimit from 'graphql-depth-limit';
import { getComplexity, fieldExtensionsEstimator, simpleEstimator } from 'graphql-query-complexity';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLError } from 'graphql';

// NOTE: These are lightweight unit-ish tests that validate the Apollo server
// rejects requests when depth/complexity limits are exceeded *before* any
// resolver executes, and that rejection surfaces as a normal GraphQL error
// (not an unhandled exception / HTTP 500). They mirror the enforcement
// wired up in src/graphql/graphql.module.ts + src/graphql/plugins/complexity.plugin.ts,
// without requiring the full NestJS bootstrap.

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

  // Every resolver is wrapped in a jest.fn() spy so tests can assert
  // resolvers were never invoked for a rejected query (acceptance
  // criterion: rejection happens at the validation/pre-execution level,
  // not inside a resolver try/catch).
  const resolverSpies = {
    a: jest.fn(() => ({ b: {} })),
    b: jest.fn(() => ({ c: {} })),
    c: jest.fn(() => ({ d: {} })),
    d: jest.fn(() => ({ e: {} })),
    e: jest.fn(() => ({ f: {} })),
    f: jest.fn(() => ({ g: {} })),
    g: jest.fn(() => ({ h: 'ok' })),
    h: jest.fn(() => 'ok'),
  };

  const resolvers = {
    Query: { a: resolverSpies.a },
    Level1: { b: resolverSpies.b },
    Level2: { c: resolverSpies.c },
    Level3: { d: resolverSpies.d },
    Level4: { e: resolverSpies.e },
    Level5: { f: resolverSpies.f },
    Level6: { g: resolverSpies.g },
    Level7: { h: resolverSpies.h },
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

  beforeEach(() => {
    Object.values(resolverSpies).forEach((spy) => spy.mockClear());
  });

  it('allows a small valid query and invokes resolvers normally (control case)', async () => {
    const query = `query Small { a { b { c { d { e { h: __typename } } } } } }`;

    const result = await server.executeOperation({ query, operationName: 'Small' } as any);

    expect(result.body.kind).toBe('single');
    if (result.body.kind === 'single') {
      expect(result.body.singleResult.errors).toBeUndefined();
    }
    expect(resolverSpies.a).toHaveBeenCalledTimes(1);
    expect(resolverSpies.b).toHaveBeenCalledTimes(1);
  });

  it('rejects over-depth query with a GraphQL error, not a 500/crash', async () => {
    const query = `
      query OverDepth { a { b { c { d { e { f { g { h } } } } } } } }
    `;

    const result = await server.executeOperation({ query, operationName: 'OverDepth' } as any);

    expect(result.body.kind).toBe('single');
    const errors =
      result.body.kind === 'single' ? result.body.singleResult.errors : undefined;
    expect(errors?.[0]).toBeInstanceOf(GraphQLError);
    expect(errors?.[0].extensions?.code).toBeDefined();
  });

  it('never invokes any resolver for an over-depth query', async () => {
    const query = `
      query OverDepth { a { b { c { d { e { f { g { h } } } } } } } }
    `;

    await server.executeOperation({ query, operationName: 'OverDepth' } as any);

    // Depth-limit validation fails during GraphQL's validation phase —
    // strictly before execution — so no resolver in the chain should run.
    Object.values(resolverSpies).forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it('rejects over-complexity query with QUERY_COMPLEXITY_EXCEEDED', async () => {
    // Increase complexity by requesting repeated leaf fields via aliases
    const query = `
      query OverComplexity { a { b { c { d { e { f { g { h a1:h a2:h a3:h a4:h a5:h a6:h a7:h a8:h a9:h a10:h a11:h a12:h } } } } } } } }
    `;

    const result = await server.executeOperation({ query, operationName: 'OverComplexity' } as any);

    const errors =
      result.body.kind === 'single' ? result.body.singleResult.errors : undefined;
    expect(errors?.[0].extensions?.code).toBe('QUERY_COMPLEXITY_EXCEEDED');
  });

  it('never invokes the leaf resolver for an over-complexity query', async () => {
    const query = `
      query OverComplexity { a { b { c { d { e { f { g { h a1:h a2:h a3:h a4:h a5:h a6:h a7:h a8:h a9:h a10:h a11:h a12:h } } } } } } } }
    `;

    await server.executeOperation({ query, operationName: 'OverComplexity' } as any);

    // Complexity is computed statically from the document in
    // didResolveOperation, which runs before execution starts — so even
    // though this query is within the depth limit, no resolver should run.
    Object.values(resolverSpies).forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});
