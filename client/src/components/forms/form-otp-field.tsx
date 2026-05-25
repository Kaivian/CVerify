"use client";

import React from 'react';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { TextField, Label, FieldError } from '@heroui/react';
import OtpInput from '../ui/otp-input';

interface FormOtpFieldProps<TFieldValues extends FieldValues = FieldValues> {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  length?: number;
  groups?: number[];
  variant?: 'compact' | 'default' | 'large';
  label?: string;
  isDisabled?: boolean;
}

export const FormOtpField = <TFieldValues extends FieldValues = FieldValues>({
  name,
  control,
  length = 6,
  groups = [3, 3],
  variant = 'default',
  label = 'Verification Code',
  isDisabled = false,
}: FormOtpFieldProps<TFieldValues>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          isRequired
          name={name}
          isInvalid={fieldState.invalid}
          className="flex flex-col gap-2 items-center w-full"
        >
          {label && (
            <Label className="text-xs font-semibold text-foreground/80">
              {label}
            </Label>
          )}
          <OtpInput
            value={field.value || ''}
            onChange={field.onChange}
            length={length}
            groups={groups}
            variant={variant}
            isDisabled={isDisabled}
            isInvalid={fieldState.invalid}
          />
          {fieldState.error && (
            <FieldError className="text-danger text-xs font-semibold mt-1">
              {fieldState.error.message}
            </FieldError>
          )}
        </TextField>
      )}
    />
  );
};

export default FormOtpField;
