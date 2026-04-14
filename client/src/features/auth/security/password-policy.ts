export interface PasswordRule {
  id: string;
  labelKey: string;
  defaultLabel: string;
  test: (value: string) => boolean;
  weight?: number;
}

export interface PasswordPolicy {
  id: string;
  minLength: number;
  rules: PasswordRule[];
}

export interface PasswordEvaluationResult {
  score: number;       // total score out of max possible score
  maxScore: number;    // maximum possible score under this policy
  percentage: number;  // completion percentage (0 - 100)
  level: 'weak' | 'fair' | 'strong' | 'excellent';
  passedRules: PasswordRule[];
  failedRules: PasswordRule[];
}

// Global regular expressions matching backend definitions exactly
export const SPECIAL_CHARACTER_REGEX = /[@$!%*?&#^()_\-+=\[\]{}|\\:;""'<>,.?/~`]/;

// Standard individual rules
export const rulesRegistry: Record<string, PasswordRule> = {
  uppercase: {
    id: 'uppercase',
    labelKey: 'auth:passwordStrength.uppercase',
    defaultLabel: 'One uppercase letter',
    test: (val) => /[A-Z]/.test(val),
    weight: 1
  },
  lowercase: {
    id: 'lowercase',
    labelKey: 'auth:passwordStrength.lowercase',
    defaultLabel: 'One lowercase letter',
    test: (val) => /[a-z]/.test(val),
    weight: 1
  },
  digit: {
    id: 'digit',
    labelKey: 'auth:passwordStrength.digit',
    defaultLabel: 'One number',
    test: (val) => /\d/.test(val),
    weight: 1
  },
  special: {
    id: 'special',
    labelKey: 'auth:passwordStrength.special',
    defaultLabel: 'One special character',
    test: (val) => SPECIAL_CHARACTER_REGEX.test(val),
    weight: 1
  }
};

// Configurable multi-policy profiles (Enterprise scaling)
export const passwordPoliciesRegistry: Record<string, PasswordPolicy> = {
  default: {
    id: 'default',
    minLength: 8,
    rules: [
      {
        id: 'length',
        labelKey: 'auth:passwordStrength.minChars8',
        defaultLabel: 'At least 8 characters',
        test: (val) => val.length >= 8,
        weight: 1
      },
      rulesRegistry.uppercase,
      rulesRegistry.lowercase,
      rulesRegistry.digit,
      rulesRegistry.special
    ]
  },
  enterprise: {
    id: 'enterprise',
    minLength: 12,
    rules: [
      {
        id: 'length',
        labelKey: 'auth:passwordStrength.minChars12',
        defaultLabel: 'Min 12 characters',
        test: (val) => val.length >= 12,
        weight: 1
      },
      rulesRegistry.uppercase,
      rulesRegistry.lowercase,
      rulesRegistry.digit,
      rulesRegistry.special
    ]
  }
};

/**
 * Pure dynamic evaluator for password complexity under a selected policy.
 * Decouples scoring, criteria list, levels, and percentages from any direct UI components.
 */
export interface PasswordPolicyResult {
  isValid: boolean;
  passedRules: PasswordRule[];
  failedRules: PasswordRule[];
}

/**
 * Pure policy checker. Returns raw validation details and checklist states.
 * Serves as the single source of truth for both Zod schemas and UI checks.
 */
export function evaluatePasswordPolicy(
  password: string,
  policyId: string = 'default'
): PasswordPolicyResult {
  const policy = passwordPoliciesRegistry[policyId] || passwordPoliciesRegistry.default;
  const passedRules: PasswordRule[] = [];
  const failedRules: PasswordRule[] = [];

  if (!password) {
    return {
      isValid: false,
      passedRules,
      failedRules: [...policy.rules]
    };
  }

  for (const rule of policy.rules) {
    if (rule.test(password)) {
      passedRules.push(rule);
    } else {
      failedRules.push(rule);
    }
  }

  return {
    isValid: failedRules.length === 0,
    passedRules,
    failedRules
  };
}

/**
 * Dynamic evaluator for password complexity strength.
 * Computes scores, completion percentage, and security levels for the UI meter.
 */
export function evaluatePasswordStrength(
  password: string,
  policyId: string = 'default'
): PasswordEvaluationResult {
  const policy = passwordPoliciesRegistry[policyId] || passwordPoliciesRegistry.default;
  const { isValid, passedRules, failedRules } = evaluatePasswordPolicy(password, policyId);
  const maxPossibleScore = policy.rules.reduce((acc, r) => acc + (r.weight || 1), 0);

  if (!password) {
    return {
      score: 0,
      maxScore: maxPossibleScore,
      percentage: 0,
      level: 'weak',
      passedRules,
      failedRules
    };
  }

  const totalScore = passedRules.reduce((acc, r) => acc + (r.weight || 1), 0);
  const percentage = Math.round((totalScore / maxPossibleScore) * 100);

  // Derive level classifications based on passed rules ratio
  let level: 'weak' | 'fair' | 'strong' | 'excellent' = 'weak';
  const passedRatio = totalScore / maxPossibleScore;

  if (passedRatio === 1.0) {
    level = 'excellent';
  } else if (passedRatio >= 0.8) {
    level = 'strong';
  } else if (passedRatio >= 0.5) {
    level = 'fair';
  }

  return {
    score: totalScore,
    maxScore: maxPossibleScore,
    percentage,
    level,
    passedRules,
    failedRules
  };
}
