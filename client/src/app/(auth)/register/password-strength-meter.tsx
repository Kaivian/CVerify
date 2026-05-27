"use client";

import React from 'react';
import { useWatch, type Control, type FieldValues, type Path } from 'react-hook-form';
import CentralPasswordStrengthMeter from '@/features/auth/components/password-strength-meter';

interface PasswordStrengthMeterProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
}

export const PasswordStrengthMeter = <TFieldValues extends FieldValues = FieldValues>({
  control,
}: PasswordStrengthMeterProps<TFieldValues>) => {
  // Isolated watch subscription to avoid re-rendering parent form component
  const watchedPassword = (useWatch({
    control,
    name: 'password' as Path<TFieldValues>,
  }) as string | undefined) || '';

  return <CentralPasswordStrengthMeter value={watchedPassword} policyId="default" />;
};

export default PasswordStrengthMeter;
