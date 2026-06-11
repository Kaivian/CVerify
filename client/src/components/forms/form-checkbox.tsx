"use client";

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Checkbox, Typography } from '@heroui/react';

interface FormCheckboxProps {
  name: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
  name,
  children,
  disabled = false,
}) => {
  const { control, formState: { errors } } = useFormContext();
  const error = errors[name];
  const translatedMessage = error?.message as string | undefined;

  return (
    <div className="flex flex-col gap-1 w-full">
      <Controller
        name={name}
        control={control}
        render={({ field: { value, onChange } }) => (
          <Checkbox
            isDisabled={disabled}
            isSelected={!!value}
            onChange={onChange}
            className="flex items-center gap-2.5 group cursor-pointer select-none text-muted text-xs font-normal"
          >
            <Checkbox.Control className="w-4 h-4 rounded border border-field-border flex items-center justify-center bg-field group-data-[selected=true]:bg-accent group-data-[selected=true]:border-accent transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-focus">
              <Checkbox.Indicator className="text-accent-foreground flex items-center justify-center">
                {/* Crisp premium Checkmark Icon */}
                <svg className="w-2.5 h-2.5 fill-none stroke-current stroke-3" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </Checkbox.Indicator>
            </Checkbox.Control>
            <Checkbox.Content className="selection:bg-transparent">
              {children}
            </Checkbox.Content>
          </Checkbox>
        )}
      />
      {translatedMessage && (
        <Typography
          type="body-xs"
          className="text-danger pl-1 font-medium mt-1 block"
          role="alert"
        >
          {translatedMessage}
        </Typography>
      )}
    </div>
  );
};
export default FormCheckbox;
