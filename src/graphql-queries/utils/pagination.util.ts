import { PaginationInput } from '../inputs';
import { PageInfo } from '../types/pagination.type';

export interface CursorPage<T> {
  edges: Array<{ cursor: string; node: T }>;
  pageInfo: PageInfo;
  totalCount: number;
}

/**
 * Encode/decode cursors as base64-encoded JSON objects.
 * Format: { id: string; createdAt: string }
 */
export function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString(
    'base64',
  );
}

export function decodeCursor(cursor: string): { id: string; createdAt: string } {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
}

/**
 * Build a Relay-style connection from a plain array.
 * The array should already be fetched with +1 item to detect hasNextPage.
 */
export function buildConnection<T extends { id: string; createdAt: Date }>(
  items: T[],
  pagination: PaginationInput,
  totalCount: number,
): CursorPage<T> {
  const limit = pagination.first ?? 20;
  const hasNextPage = items.length > limit;
  const slice = hasNextPage ? items.slice(0, limit) : items;

  const edges = slice.map((node) => ({
    cursor: encodeCursor(node.id, node.createdAt),
    node,
  }));

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: !!pagination.after,
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor,
    },
    totalCount,
  };
}
