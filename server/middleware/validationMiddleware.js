const validate = (schema) => {
  return (req, res, next) => {
    try {
      // Validate request against schema
      const result = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });

      // Replace req.body with validated data
      req.body = result.body || req.body;
      req.query = result.query || req.query;
      req.params = result.params || req.params;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
          code: 'VALIDATION_ERROR'
        });
      }

      // Handle other errors
      return res.status(500).json({
        success: false,
        message: 'Internal server error during validation',
        code: 'VALIDATION_PROCESS_ERROR'
      });
    }
  };
};

export default validate;