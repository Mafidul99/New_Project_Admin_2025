export class ApiResponse {
  constructor(success, message, data = null, code = null) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }

  static success(message, data = null, code = 'SUCCESS') {
    return new ApiResponse(true, message, data, code);
  }

  static error(message, code = 'ERROR', data = null) {
    return new ApiResponse(false, message, data, code);
  }
}

export const sendSuccess = (res, message, data = null, code = 'SUCCESS', statusCode = 200) => {
  return res.status(statusCode).json(ApiResponse.success(message, data, code));
};

export const sendError = (res, message, code = 'ERROR', statusCode = 400, data = null) => {
  return res.status(statusCode).json(ApiResponse.error(message, code, data));
};

export const handleAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};