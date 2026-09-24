export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'طلب غير صالح', details?: unknown) {
    return new ApiError(400, message, 'bad_request', details);
  }
  static unauthorized(message = 'غير مصرح') {
    return new ApiError(401, message, 'unauthorized');
  }
  static forbidden(message = 'لا تملك صلاحية لهذه العملية') {
    return new ApiError(403, message, 'forbidden');
  }
  static notFound(message = 'العنصر غير موجود') {
    return new ApiError(404, message, 'not_found');
  }
  static conflict(message = 'تعارض في البيانات') {
    return new ApiError(409, message, 'conflict');
  }
  static tooMany(message = 'محاولات كثيرة، حاول لاحقًا') {
    return new ApiError(429, message, 'rate_limited');
  }
}
