import { z } from 'zod';

// Common validation patterns
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

export const registerSchema = z.object({
  body: z.object({
    name: z.string()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name cannot exceed 50 characters')
      .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
    email: z.string()
      .email('Invalid email address')
      .max(100, 'Email cannot exceed 100 characters'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(passwordRegex, 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    role: z.enum(['user', 'admin', 'manager']).default('user')
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
  })
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required')
  })
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name cannot exceed 50 characters')
      .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces')
      .optional()
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(passwordRegex, 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character')
  })
});

// Export all schemas
export const authSchemas = {
  register: registerSchema,
  login: loginSchema,
  refreshToken: refreshTokenSchema,
  updateProfile: updateProfileSchema,
  changePassword: changePasswordSchema
};