import { z } from "zod";
import {
  passwordValidation,
  enterprisePasswordValidation,
  PHONE_NUMBER_REGEX,
} from "./auth.validator";

const defaultPasswordSchema = z.object({
  password: passwordValidation,
});

const enterprisePasswordSchema = z.object({
  password: enterprisePasswordValidation,
});

function runTests() {
  console.log("Starting validation tests...");

  // 1. DEFAULT PASSWORD POLICY TESTS (Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special)
  console.log("Running default password validation tests...");
  
  // Valid default passwords
  assert(defaultPasswordSchema.safeParse({ password: "P@ssword1" }).success, "P@ssword1 should be valid");
  assert(defaultPasswordSchema.safeParse({ password: "StrongPass!123" }).success, "StrongPass!123 should be valid");
  
  // Invalid default passwords (boundary and missing criteria)
  assert(!defaultPasswordSchema.safeParse({ password: "P@ssw1" }).success, "7 characters should be invalid");
  assert(!defaultPasswordSchema.safeParse({ password: "p@ssword1" }).success, "Missing uppercase should be invalid");
  assert(!defaultPasswordSchema.safeParse({ password: "P@SSWORD1" }).success, "Missing lowercase should be invalid");
  assert(!defaultPasswordSchema.safeParse({ password: "P@ssword" }).success, "Missing digit should be invalid");
  assert(!defaultPasswordSchema.safeParse({ password: "Password1" }).success, "Missing special character should be invalid");

  // 2. ENTERPRISE PASSWORD POLICY TESTS (Min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special)
  console.log("Running enterprise password validation tests...");
  
  // Valid enterprise passwords
  assert(enterprisePasswordSchema.safeParse({ password: "P@ssword12345" }).success, "P@ssword12345 (13 chars) should be valid");
  assert(enterprisePasswordSchema.safeParse({ password: "V3ryStr0ngP@ss" }).success, "V3ryStr0ngP@ss (14 chars) should be valid");
  assert(enterprisePasswordSchema.safeParse({ password: "A1b2C3d4!e5f" }).success, "A1b2C3d4!e5f (12 chars) should be valid");

  // Invalid enterprise passwords (boundary and missing criteria)
  assert(!enterprisePasswordSchema.safeParse({ password: "P@ssword123" }).success, "11 characters should be invalid");
  assert(!enterprisePasswordSchema.safeParse({ password: "p@ssword12345" }).success, "Missing uppercase should be invalid");
  assert(!enterprisePasswordSchema.safeParse({ password: "P@SSWORD12345" }).success, "Missing lowercase should be invalid");
  assert(!enterprisePasswordSchema.safeParse({ password: "P@ssword!!!!!" }).success, "Missing digit should be invalid");
  assert(!enterprisePasswordSchema.safeParse({ password: "Password12345" }).success, "Missing special character should be invalid");

  // 3. PHONE NUMBER REGEX TESTS (Starts with +84, followed by 9 or 10 digits)
  console.log("Running phone number validation tests...");
  
  // Valid E.164 phone formats
  assert(PHONE_NUMBER_REGEX.test("+84901234567"), "+84901234567 (9 subscriber digits) should be valid");
  assert(PHONE_NUMBER_REGEX.test("+842431234567"), "+842431234567 (10 subscriber digits) should be valid");

  // Invalid phone formats
  assert(!PHONE_NUMBER_REGEX.test("+8490123456"), "Too short (8 subscriber digits) should be invalid");
  assert(!PHONE_NUMBER_REGEX.test("+8490123456789"), "Too long (11 subscriber digits) should be invalid");
  assert(!PHONE_NUMBER_REGEX.test("0901234567"), "Missing prefix should be invalid");
  assert(!PHONE_NUMBER_REGEX.test("+084901234567"), "Wrong country prefix (+084) should be invalid");
  assert(!PHONE_NUMBER_REGEX.test("+8490123456a"), "Non-numeric characters should be invalid");

  console.log("All validation tests passed successfully!");
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`Assertion failed: ${message}`);
    process.exit(1);
  }
}

runTests();
