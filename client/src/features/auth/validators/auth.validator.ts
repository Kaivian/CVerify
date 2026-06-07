import { z } from 'zod';
import { evaluatePasswordPolicy } from '../security/password-policy';

// Vietnamese phone E.164 standard regex: starts with +84 followed by 9 or 10 digits
export const PHONE_NUMBER_REGEX = /^\+84[0-9]{9,10}$/;

export const passwordValidation = z.string().superRefine((val, ctx) => {
  const policyResult = evaluatePasswordPolicy(val, 'default');
  if (!policyResult.isValid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'auth:validation.passwordStrength',
    });
  }
});

export const enterprisePasswordValidation = z.string().superRefine((val, ctx) => {
  const policyResult = evaluatePasswordPolicy(val, 'enterprise');
  if (!policyResult.isValid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'auth:validation.enterprisePasswordStrength',
    });
  }
});

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'auth:validation.emailRequired' })
    .email({ message: 'auth:validation.emailInvalid' }),
  password: z
    .string()
    .min(1, { message: 'auth:validation.passwordRequired' }),
  rememberMe: z.boolean(),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, { message: 'auth:validation.fullNameMin' })
      .max(100, { message: 'auth:validation.fullNameMax' })
      .trim()
      .regex(/^[\p{L}\p{M}\s'-]+$/u, {
        message: 'auth:validation.fullNameInvalid',
      }),
    email: z
      .string()
      .min(1, { message: 'auth:validation.emailRequired' })
      .email({ message: 'auth:validation.emailInvalid' })
      .toLowerCase(),
    password: passwordValidation,
    confirmPassword: z.string().min(1, { message: 'auth:validation.confirmPasswordRequired' }),
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: 'auth:validation.agreeTermsRequired',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth:validation.passwordsMismatch',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'auth:validation.emailRequired' })
    .email({ message: 'auth:validation.emailInvalid' }),
});

export const resetPasswordSchema = z
  .object({
    password: passwordValidation,
    confirmPassword: z.string().min(1, { message: 'auth:validation.confirmPasswordRequired' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth:validation.passwordsMismatch',
    path: ['confirmPassword'],
  });

export const createPasswordSchema = z
  .object({
    challengeId: z.string().uuid(),
    email: z.string().email(),
    verificationToken: z.string(),
    password: passwordValidation,
    confirmPassword: z.string().min(1, { message: 'auth:validation.confirmPasswordRequired' }),
    fullName: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth:validation.passwordsMismatch',
    path: ['confirmPassword'],
  });

export const registerCompanySchema = z.object({
  companyName: z.string().min(2, { message: 'Company name must be at least 2 characters' }),
  taxCode: z.string().regex(/^\d{10}$/, { message: 'Tax code must be exactly 10 digits' }),
  companyEmail: z.string().email({ message: 'Invalid company email address' }),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms',
  }),
});

export const setupWorkspaceSchema = z
  .object({
    verificationToken: z.string(),
    companyEmail: z.string().email(),
    organizationUsername: z.string().regex(/^[a-z0-9_]{3,30}$/, {
      message: 'Workspace name must be 3-30 characters, lowercase alphanumeric or underscore',
    }),
    password: passwordValidation,
    confirmPassword: z.string().min(1, { message: 'auth:validation.confirmPasswordRequired' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth:validation.passwordsMismatch',
    path: ['confirmPassword'],
  });

export const companyLoginSchema = z.object({
  organizationUsername: z.string().min(1, { message: 'Workspace name is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

