"use client";

import React, { useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { TextField, Input, Label, FieldError, Typography } from '@heroui/react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FormInputProps {
  name: string;
  type?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  name,
  type = 'text',
  label,
  placeholder,
  disabled = false,
  autoComplete,
}) => {
  const { control, formState: { errors } } = useFormContext();
  const { t } = useTranslation();
  const error = errors[name];
  const errorMessage = error?.message as string | undefined;
  const translatedMessage = errorMessage
    ? (errorMessage.includes(':') ? (t as (key: string) => string)(errorMessage) : errorMessage)
    : undefined;

  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const isPassword = type === 'password';
  const currentType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      <Controller
        name={name}
        control={control}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextField
            isInvalid={!!translatedMessage}
            className="flex flex-col gap-1.5 w-full"
          >
            {label && (
              <Label className="text-foreground/80 text-xs font-semibold select-none">
                {label}
              </Label>
            )}
            
            <div className="relative flex items-center w-full">
              <Input
                type={currentType}
                value={value || ''}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                className={[
                  "w-full px-3.5 py-2.5 rounded-xl border transition-all text-xs outline-hidden font-medium bg-field text-foreground placeholder-field-placeholder",
                  translatedMessage
                    ? "border-danger focus:border-danger focus:ring-1 focus:ring-danger/20"
                    : "border-field-border focus:border-focus focus:ring-1 focus:ring-focus/20",
                  disabled ? "opacity-[var(--disabled-opacity)] cursor-not-allowed bg-surface-secondary" : "",
                ].join(' ')}
              />
              
              {/* Password visibility toggle */}
              {isPassword && (
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3.5 text-muted hover:text-foreground transition-colors cursor-pointer select-none focus-ring rounded-md p-0.5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>

            {translatedMessage && (
              <FieldError className="block">
                <Typography
                  slot="errorMessage"
                  type="body-xs"
                  className="text-danger pl-1 font-medium animate-fade-in block"
                >
                  {translatedMessage}
                </Typography>
              </FieldError>
            )}
          </TextField>
        )}
      />
    </div>
  );
};
export default FormInput;
