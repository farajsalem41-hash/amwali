export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export function pagination(query: Record<string, unknown>, defaultLimit = 20): Pagination {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Escapes user input before using it inside a RegExp (prevents ReDoS / injection). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function meta(total: number, p: Pagination) {
  return { total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) || 1 };
}
