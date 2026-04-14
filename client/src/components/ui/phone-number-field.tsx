"use client";

import React from "react";
import { TextField, Label, InputGroup, FieldError } from "@heroui/react";
import { useTranslation } from "react-i18next";

interface PhoneNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  countryCode?: string;
  isInvalid?: boolean;
  errorMessage?: string;
  label?: string;
  id?: string;
  name?: string;
  isRequired?: boolean;
  className?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

/**
 * Reusable accessible phone number input field.
 * Standardizes inputs to E.164 formats while presenting a premium UI prefix.
 */
export const PhoneNumberField: React.FC<PhoneNumberFieldProps> = ({
  value,
  onChange,
  countryCode = "+84",
  isInvalid = false,
  errorMessage,
  label = "Phone Number",
  id = "input-type-phone",
  name = "phoneNumber",
  isRequired = false,
  className = "flex flex-col w-full h-full",
  onBlur,
}) => {
  const { t } = useTranslation(["auth"]);

  // Extracts displayable subscriber digits by removing country prefixes
  const getDisplayValue = (val: string) => {
    if (!val) return "";
    
    // Remove exact matching country code prefix
    if (val.startsWith(countryCode)) {
      return val.slice(countryCode.length);
    }
    
    // Fallback overrides for alternative Vietnam prefix variants
    if (countryCode === "+84") {
      if (val.startsWith("+084")) return val.slice(4);
      if (val.startsWith("084")) return val.slice(3);
      if (val.startsWith("0") && val.length > 1) return val.slice(1);
    }
    
    return val;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const sanitizedVal = rawVal.replace(/[^0-9]/g, ""); // Retain digits only
    
    if (sanitizedVal === "") {
      onChange("");
    } else {
      onChange(`${countryCode}${sanitizedVal}`);
    }
  };

  const displayValue = getDisplayValue(value);

  return (
    <TextField
      isRequired={isRequired}
      name={name}
      isInvalid={isInvalid}
      className={className}
    >
      <Label htmlFor={id}>{label}</Label>
      <InputGroup>
        <InputGroup.Prefix 
          className="text-muted text-xs font-mono bg-background select-none"
          aria-hidden="true"
        >
          {countryCode}
        </InputGroup.Prefix>
        <InputGroup.Input
          id={id}
          type="tel"
          placeholder="912345678"
          className="pl-2"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={onBlur}
          aria-label={t("auth:labels.phoneAriaLabel", { 
            code: countryCode, 
            defaultValue: `Phone number, country code ${countryCode}` 
          })}
        />
      </InputGroup>
      {isInvalid && errorMessage && (
        <FieldError>{errorMessage}</FieldError>
      )}
    </TextField>
  );
};

export default PhoneNumberField;
