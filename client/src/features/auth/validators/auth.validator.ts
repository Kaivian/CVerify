import { z } from 'zod';
import { evaluatePasswordPolicy } from '../security/password-policy';

// Vietnamese phone E.164 standard regex: starts with +84 followed by 9 or 10 digits
export const PHONE_NUMBER_REGEX = /^\+84[0-9]{9,10}$/;

export const passwordValidation = z.string().superRefine((val, ctx) => {
  const policyResult = evaluatePasswordPolicy(val, 'default');
  if (!policyResult.isValid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    });
  }
});

export const enterprisePasswordValidation = z.string().superRefine((val, ctx) => {
  const policyResult = evaluatePasswordPolicy(val, 'enterprise');
  if (!policyResult.isValid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Password must contain at least 12 characters, including one uppercase letter, one lowercase letter, one number, and one special character.',
    });
  }
});

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email address is required.' })
    .email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(1, { message: 'Password is required.' }),
  rememberMe: z.boolean(),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, { message: 'Full name must be at least 2 characters.' })
      .max(100, { message: 'Full name cannot exceed 100 characters.' })
      .trim()
      .regex(/^[\p{L}\p{M}\s'-]+$/u, {
        message: 'Full name can only contain letters, spaces, hyphens, and apostrophes.',
      }),
    email: z
      .string()
      .min(1, { message: 'Email address is required.' })
      .email({ message: 'Please enter a valid email address.' })
      .toLowerCase(),
    password: passwordValidation,
    confirmPassword: z.string().min(1, { message: 'Confirm password is required.' }),
    agreeTerms: z.boolean().refine((val) => val === true, {
      message: 'You must agree to the Terms of Service and Privacy Policy.',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email address is required.' })
    .email({ message: 'Please enter a valid email address.' }),
});

export const resetPasswordSchema = z
  .object({
    password: passwordValidation,
    confirmPassword: z.string().min(1, { message: 'Confirm password is required.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const createPasswordSchema = z
  .object({
    challengeId: z.string().uuid(),
    email: z.string().email(),
    verificationToken: z.string(),
    password: passwordValidation,
    confirmPassword: z.string().min(1, { message: 'Confirm password is required.' }),
    fullName: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
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

export const registerOrganizationSchema = z.object({
  organizationName: z.string().min(2, { message: 'Organization name must be at least 2 characters' }),
  taxCode: z.string().regex(/^\d{10}$/, { message: 'Tax code must be exactly 10 digits' }),
  organizationEmail: z.string().email({ message: 'Invalid organization email address' }),
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
    confirmPassword: z.string().min(1, { message: 'Confirm password is required.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const setupOrganizationWorkspaceSchema = z
  .object({
    verificationToken: z.string(),
    organizationEmail: z.string().email(),
    organizationUsername: z.string().regex(/^[a-z0-9_]{3,30}$/, {
      message: 'Workspace name must be 3-30 characters, lowercase alphanumeric or underscore',
    }),
    password: passwordValidation,
    confirmPassword: z.string().min(1, { message: 'Confirm password is required.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const companyLoginSchema = z.object({
  organizationUsername: z.string().min(1, { message: 'Workspace name is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

export const organizationLoginSchema = z.object({
  organizationUsername: z.string().min(1, { message: 'Workspace name is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

