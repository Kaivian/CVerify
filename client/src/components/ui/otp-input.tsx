"use client";

import React from 'react';
import { InputOTP } from '@heroui/react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  groups?: number[];
  separator?: React.ReactNode;
  variant?: 'compact' | 'default' | 'large';
  isInvalid?: boolean;
  isDisabled?: boolean;
  className?: string;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  length = 6,
  groups = [3, 3],
  separator = <InputOTP.Separator />,
  variant = 'default',
  isInvalid = false,
  isDisabled = false,
  className = '',
}) => {
  // Validate groups configuration matches expected total length
  const resolvedGroups = React.useMemo(() => {
    const totalGroupSlots = groups.reduce((acc, val) => acc + val, 0);
    if (totalGroupSlots === length) {
      return groups;
    }
    return [length]; // Continuous fallback
  }, [groups, length]);

  // Sizing variants tokens
  const slotSizeClass = React.useMemo(() => {
    switch (variant) {
      case 'compact':
        return 'h-9 w-9 text-xs rounded-lg border border-border bg-surface text-center font-semibold';
      case 'large':
        return 'h-14 w-14 text-md rounded-2xl border border-border bg-surface text-center font-extrabold';
      case 'default':
      default:
        return 'h-12 w-12 text-sm font-bold text-center bg-surface border border-border rounded-xl';
    }
  }, [variant]);

  // Render partitioned groups and slots
  const renderOtpContent = () => {
    let slotCounter = 0;

    return resolvedGroups.map((groupSize, groupIdx) => {
      const groupSlots = Array.from({ length: groupSize }, (_, i) => {
        const index = slotCounter + i;
        return (
          <InputOTP.Slot
            key={index}
            index={index}
            className={`${slotSizeClass} ${
              isInvalid 
                ? 'border-danger text-danger focus-within:ring-danger' 
                : 'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25'
            }`}
          />
        );
      });

      slotCounter += groupSize;

      return (
        <React.Fragment key={groupIdx}>
          <InputOTP.Group className="flex gap-2">
            {groupSlots}
          </InputOTP.Group>
          {groupIdx < resolvedGroups.length - 1 && separator}
        </React.Fragment>
      );
    });
  };

  return (
    <div className={`flex justify-center select-none ${className}`}>
      <InputOTP
        maxLength={length}
        value={value}
        onChange={onChange}
        isDisabled={isDisabled}
        isInvalid={isInvalid}
        role="group"
        aria-label="One-time verification code"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
      >
        {renderOtpContent()}
      </InputOTP>
    </div>
  );
};

export default OtpInput;
