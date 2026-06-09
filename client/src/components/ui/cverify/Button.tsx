"use client";

import { forwardRef } from 'react';
import { Button as HeroButton, Spinner, type ButtonProps as HeroButtonProps } from '@heroui/react';

interface ButtonProps extends Omit<HeroButtonProps, 'variant' | 'size'> {
    variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'danger-soft';
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    isPending?: boolean;
    disabled?: boolean;
}

const customVariantClasses = {
    primary: '',
    secondary: '',
    tertiary: '',
    outline: '',
    ghost: '',
    danger: '',
    'danger-soft': '',
}

const customSizeClasses = {
    xs: 'h-7 text-xs [&_svg]:size-3',
    sm: 'h-8 text-sm [&_svg]:size-3.5',
    md: 'h-9 text-md [&_svg]:size-4',
    lg: 'h-10 text-lg [&_svg]:size-4.5',
    xl: 'h-11 text-xl [&_svg]:size-5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    isPending = false,
    disabled = false,
    isDisabled,
    ...props
}, ref) => {
    const customSizeClass = customSizeClasses[size];
    const customVariantClass = customVariantClasses[variant];

    const heroUiSize = size === 'xs' ? 'sm' : size === 'xl' ? 'lg' : size;
    const spinnerSize = (size === 'xs' || size === 'sm') ? 'sm' : size === 'xl' ? 'md' : 'sm';

    return (
        <HeroButton
            ref={ref}
            {...props}
            size={heroUiSize}
            variant={variant as unknown as HeroButtonProps['variant']}
            isPending={isPending}
            isDisabled={disabled || isDisabled}
            className={`${customSizeClass} ${customVariantClass} ${className}`.trim()}
        >
            {typeof children === 'function'
                ? (values) => (
                    <>
                        {isPending && <Spinner color="current" size={spinnerSize} />}
                        {children(values)}
                    </>
                )
                : (
                    <>
                        {isPending && <Spinner color="current" size={spinnerSize} />}
                        {children}
                    </>
                )
            }
        </HeroButton>
    );
});

Button.displayName = 'Button';
export default Button;