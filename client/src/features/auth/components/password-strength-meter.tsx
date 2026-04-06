"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  evaluatePasswordStrength, 
  passwordPoliciesRegistry,
  PasswordRule
} from '../security/password-policy';

interface PasswordStrengthMeterProps {
  value: string;
  policyId?: 'default' | 'enterprise';
  className?: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  value,
  policyId = 'default',
  className = ''
}) => {
  const { t } = useTranslation(['auth']);
  
  if (!value) {
    return null;
  }

  const evaluation = evaluatePasswordStrength(value, policyId);
  const policy = passwordPoliciesRegistry[policyId] || passwordPoliciesRegistry.default;

  // Map levels to aesthetic styling attributes
  let strengthLabel = '';
  let colorClass = 'bg-surface-secondary';
  let textColorClass = 'text-muted';

  switch (evaluation.level) {
    case 'weak':
      strengthLabel = t('auth:passwordStrength.weak', { defaultValue: 'Weak (Insecure)' });
      colorClass = 'bg-danger';
      textColorClass = 'text-danger';
      break;
    case 'fair':
      strengthLabel = t('auth:passwordStrength.fair', { defaultValue: 'Fair' });
      colorClass = 'bg-warning';
      textColorClass = 'text-warning';
      break;
    case 'strong':
      strengthLabel = t('auth:passwordStrength.strong', { defaultValue: 'Strong' });
      colorClass = 'bg-success/80';
      textColorClass = 'text-success/80';
      break;
    case 'excellent':
      strengthLabel = t('auth:passwordStrength.excellent', { defaultValue: 'Very Strong & Secure' });
      colorClass = 'bg-success';
      textColorClass = 'text-success';
      break;
  }

  // Helper to determine if a specific rule in the policy has passed
  const isRulePassed = (ruleId: string) => {
    return evaluation.passedRules.some(r => r.id === ruleId);
  };

  return (
    <div className={`space-y-2 mt-2 px-1 select-none font-sans ${className}`} aria-live="polite">
      {/* Visual Header */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted text-[11px] font-medium font-sans">
          {t('auth:passwordStrength.label', { defaultValue: 'Security Strength' })}
        </span>
        <span className={`font-bold text-[11px] transition-colors duration-200 ${textColorClass}`}>
          {strengthLabel}
        </span>
      </div>

      {/* Progress Bar Track */}
      <div 
        className="flex gap-1 h-1.5 w-full bg-surface-secondary rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={evaluation.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Password strength progress"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${evaluation.percentage}%` }}
        />
      </div>

      {/* Responsive Progressive live checklist feedback */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted mt-1.5 transition-all duration-200">
        {policy.rules.map((rule: PasswordRule) => {
          const passed = isRulePassed(rule.id);
          return (
            <span
              key={rule.id}
              className={`flex items-center gap-1 transition-colors duration-200 ${
                passed ? 'text-success font-medium' : 'text-muted/80'
              }`}
            >
              <span className="font-mono">{passed ? '✓' : '○'}</span>
              <span>{t(rule.labelKey, { defaultValue: rule.defaultLabel })}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
