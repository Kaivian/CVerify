import { type ResourceActionPermission } from '../../types/auth.types';

export const FEATURE_FLAGS = {
  ENABLE_VERIFICATION_QUEUE: 'feature:admin:verification-queue',
  ENABLE_AI_TRUST_SCORES: 'feature:admin:ai-trust-scores',
  ENABLE_SUPPORT_PORTAL: 'feature:admin:support-portal',
  ENABLE_SECURITY_ALERTS: 'feature:admin:security-alerts',
} as const;

export function isModuleEnabled(
  module: { featureFlag?: string; isEnabled?: boolean },
  userPermissions: string[]
): boolean {
  if (module.isEnabled === false) {
    return false;
  }

  if (module.featureFlag) {
    const hasFlag = 
      userPermissions.includes(module.featureFlag) || 
      userPermissions.includes('*:*:*') || 
      userPermissions.includes('*');
      
    if (!hasFlag) {
      return false;
    }
  }

  return true;
}
