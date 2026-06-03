"use client";

import React, { forwardRef } from 'react';
import { Button as HeroButton, type ButtonProps as HeroButtonProps } from '@heroui/react';

interface ButtonProps extends Omit<HeroButtonProps, 'variant' | 'children'> {
  variant?: 'solid' | 'bordered' | 'light' | 'flat' | 'ghost' | 'outline' | 'primary' | 'secondary' | 'danger' | 'danger-soft';
  isLoading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'solid',
  className = '',
  isLoading = false,
  disabled = false,
  isDisabled = false,
  ...props
}, ref) => {
  let variantClasses = "";

  if (variant === 'solid') {
    variantClasses = [
      "bg-foreground text-background hover:opacity-90",
      "shadow-surface",
      "border border-foreground",
    ].join(' ');
  } else if (variant === 'bordered' || variant === 'outline') {
    variantClasses = [
      "bg-transparent border border-border text-foreground",
      "hover:bg-surface-secondary",
    ].join(' ');
  } else if (variant === 'flat' || variant === 'secondary') {
    variantClasses = [
      "bg-surface-secondary text-foreground",
      "hover:opacity-90",
    ].join(' ');
  } else if (variant === 'danger') {
    variantClasses = [
      "bg-danger text-danger-foreground hover:opacity-90",
      "border border-danger",
    ].join(' ');
  }

  let mappedVariant: 'ghost' | 'outline' | 'primary' | 'secondary' | 'danger' | 'danger-soft' | 'tertiary' = 'primary';
  if (variant === 'solid') {
    mappedVariant = 'primary';
  } else if (variant === 'bordered' || variant === 'outline') {
    mappedVariant = 'outline';
  } else if (variant === 'flat' || variant === 'secondary') {
    mappedVariant = 'secondary';
  } else if (variant === 'light') {
    mappedVariant = 'tertiary';
  } else if (variant === 'ghost') {
    mappedVariant = 'ghost';
  } else if (variant === 'danger') {
    mappedVariant = 'danger';
  }

  return (
    <HeroButton
      ref={ref}
      {...props}
      variant={mappedVariant}
      className={`${variantClasses} ${className}`}
      isDisabled={disabled || isLoading || isDisabled}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </HeroButton>
  );
});

Button.displayName = 'Button';
export default Button;
