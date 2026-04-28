// Response envelope formatter
// All API responses follow: { data, meta, error }

export const successResponse = (data, meta = {}) => ({
  data,
  meta: {
    timestamp: new Date().toISOString(),
    ...meta,
  },
  error: null,
});

export const errorResponse = (code, message, details = null) => ({
  data: null,
  meta: { timestamp: new Date().toISOString() },
  error: {
    code,
    message,
    ...(details ? { details } : {}),
  },
});

export const paginatedResponse = (data, total, page, limit) =>
  successResponse(data, { total, page, limit });
