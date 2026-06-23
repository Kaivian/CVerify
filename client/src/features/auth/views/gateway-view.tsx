"use client";

import { Google } from "@thesvg/react";
import {
  Card,
  CardFooter,
  CardHeader,
  Link,
  Tabs,
  Typography,
  Button,
  CardContent,
  TextField,
  InputGroup,
  Input,
  ErrorMessage,
  Form,
  Label,
  FieldError,
  Checkbox,
} from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import React, { useState } from "react";

export function GatewayView() {
  const validateEmail = (email: string) => {
    return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };

  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const isInvalid = touched && value.length > 0 && !validateEmail(value);
  const [isVisible, setIsVisible] = useState(false);

  // Selected Tab State
  const [selectedTab, setSelectedTab] = useState("overview");

  // Business Form State
  const [businessUsername, setBusinessUsername] = useState("");
  const [businessPassword, setBusinessPassword] = useState("");

  // Company Registration State
  const [showRegistration, setShowRegistration] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyEmailTouched, setCompanyEmailTouched] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const isCompanyEmailInvalid =
    companyEmailTouched &&
    companyEmail.length > 0 &&
    !validateEmail(companyEmail);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });
    alert(`Form submitted with: ${JSON.stringify(data, null, 2)}`);
  };

  const onReset = () => {
    setBusinessUsername("");
    setBusinessPassword("");
  };

  const onRegisterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert(
      `Registering company: ${companyName}, Tax Code: ${taxCode}, Email: ${companyEmail}, Terms Accepted: ${acceptTerms}`,
    );
    // Reset form fields
    setCompanyName("");
    setTaxCode("");
    setCompanyEmail("");
    setCompanyEmailTouched(false);
    setAcceptTerms(false);
    setSelectedTab("analytics");
    setShowRegistration(false);
  };

  return (
    <div className="w-full">
      {!showRegistration ? (
        <Card className="w-full bg-surface border border-border p-8 shadow-xl rounded-2xl">
          <Tabs
            className="w-full"
            variant="secondary"
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
          >
            <Tabs.ListContainer>
              <Tabs.List
                aria-label="Options"
                className="flex items-center gap-4 h-10 border-b border-divider w-full"
              >
                <Tabs.Tab
                  id="overview"
                  className="flex items-center justify-center h-full pb-3 flex-1"
                >
                  <Typography.Heading
                    level={5}
                    className="font-semibold text-foreground"
                  >
                    Engineer
                  </Typography.Heading>
                  <Tabs.Indicator className="bottom-0!" />
                </Tabs.Tab>
                <Tabs.Tab
                  id="analytics"
                  className="flex items-center justify-center h-full pb-3 flex-1"
                >
                  <Typography.Heading
                    level={5}
                    className="font-semibold text-foreground"
                  >
                    Business
                  </Typography.Heading>
                  <Tabs.Indicator className="!bottom-0!" />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel
              className="pt-6 flex justify-center w-full"
              id="overview"
            >
              {selectedTab === "overview" && (
                <Card
                  variant="transparent"
                  className="w-full flex flex-col items-center p-0"
                >
                  <CardHeader className="flex flex-col items-center text-center w-full p-0 mb-6">
                    <Card.Title className="text-2xl font-bold pb-2 text-foreground">
                      Proof over promises
                    </Card.Title>
                    <Card.Description className="text-sm text-muted">
                      Evidence-backed profiles for modern engineering hiring.
                    </Card.Description>
                  </CardHeader>

                  <div className="w-full pb-3">
                    <Button
                      variant="tertiary"
                      size="lg"
                      fullWidth
                      className="h-12 rounded-2xl"
                    >
                      <Google /> Continue with Google
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 w-full mb-6">
                    <div className="h-px bg-border flex-1" />
                    <span className="text-xs font-medium text-muted font-mono uppercase">
                      or
                    </span>
                    <div className="h-px bg-border flex-1" />
                  </div>

                  <CardFooter className="w-full flex flex-col items-center gap-4 p-0">
                    <TextField
                      fullWidth
                      isInvalid={isInvalid}
                      aria-label="Email Address"
                    >
                      <Input
                        className="h-12 border-border rounded-xl"
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={value}
                        aria-label="Email Address"
                        onChange={(e) => {
                          setValue(e.target.value);
                          setTouched(true);
                        }}
                        onBlur={() => setTouched(true)}
                      />
                      {isInvalid && (
                        <div className="text-left w-full mt-1">
                          <ErrorMessage className="text-danger text-xs font-medium">
                            Please enter a valid email address.
                          </ErrorMessage>
                        </div>
                      )}
                    </TextField>

                    <Button
                      size="lg"
                      fullWidth
                      isDisabled={isInvalid || !value}
                      className="h-12 rounded-xl bg-foreground text-background font-semibold flex items-center justify-center"
                    >
                      Continue with email
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </Tabs.Panel>

            <Tabs.Panel
              className="pt-6 flex justify-center w-full"
              id="analytics"
            >
              {selectedTab === "analytics" && (
                <Card
                  variant="transparent"
                  className="w-full flex flex-col items-center p-0"
                >
                  <CardHeader className="flex flex-col items-center text-center w-full p-0 mb-6">
                    <Card.Title className="text-2xl font-bold pb-2 text-foreground">
                      Hire beyond resumes
                    </Card.Title>
                    <Card.Description className="text-sm text-muted">
                      Verify engineering talent through real technical evidence.
                    </Card.Description>
                  </CardHeader>

                  <CardContent className="w-full p-0">
                    <Form
                      className="flex flex-col gap-5"
                      onSubmit={onSubmit}
                      onReset={onReset}
                    >
                      <TextField isRequired name="username" type="text">
                        <Label className="text-sm font-medium text-foreground/80 pb-1">
                          Username
                        </Label>
                        <Input
                          placeholder="Enter your username"
                          className="h-12"
                          value={businessUsername}
                          onChange={(e) => setBusinessUsername(e.target.value)}
                        />
                        <FieldError />
                      </TextField>

                      <TextField isRequired name="password" type="password">
                        <Label className="text-sm font-medium text-foreground/80 pb-1">
                          Password
                        </Label>
                        <InputGroup>
                          <InputGroup.Input
                            className="h-12"
                            type={isVisible ? "text" : "password"}
                            placeholder="Enter your password"
                            value={businessPassword}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => setBusinessPassword(e.target.value)}
                          />
                          <InputGroup.Suffix>
                            <Button
                              isIconOnly
                              aria-label={
                                isVisible ? "Hide password" : "Show password"
                              }
                              size="sm"
                              variant="ghost"
                              onPress={() => setIsVisible(!isVisible)}
                              className="text-muted hover:bg-transparent"
                            >
                              {isVisible ? (
                                <Eye className="size-4" />
                              ) : (
                                <EyeOff className="size-4" />
                              )}
                            </Button>
                          </InputGroup.Suffix>
                        </InputGroup>
                        <FieldError />
                      </TextField>

                      <div className="flex items-center justify-between pb-2">
                        <Checkbox id="remember-me" className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <Checkbox.Content>
                            <Label
                              htmlFor="remember-me"
                              className="text-xs font-medium text-muted cursor-pointer"
                            >
                              Remember me
                            </Label>
                          </Checkbox.Content>
                        </Checkbox>

                        <Link className="text-xs font-semibold text-muted hover:text-foreground hover:underline cursor-pointer">
                          Forgot password?
                        </Link>
                      </div>

                      <div className="flex gap-4">
                        <Button
                          type="submit"
                          fullWidth
                          className="h-12 rounded-xl bg-foreground text-background font-semibold"
                          isDisabled={!businessUsername || !businessPassword}
                        >
                          Sign In
                        </Button>
                        <Button
                          type="reset"
                          variant="secondary"
                          fullWidth
                          className="h-12 rounded-xl"
                        >
                          Reset
                        </Button>
                      </div>
                    </Form>
                  </CardContent>

                  <div className="text-center text-xs font-medium text-muted pt-6">
                    New to CVerify?{" "}
                    <Link
                      onPress={() => setShowRegistration(true)}
                      className="font-semibold text-foreground hover:underline cursor-pointer"
                    >
                      Register your company
                    </Link>
                  </div>
                </Card>
              )}
            </Tabs.Panel>
          </Tabs>
        </Card>
      ) : (
        <Card className="w-full bg-surface border border-border p-8 shadow-xl rounded-2xl">
          <div className="w-full flex flex-col items-center">
            <CardHeader className="flex flex-col items-center text-center w-full p-0 mb-6">
              <Card.Title className="text-2xl font-bold pb-2 text-foreground">
                Register your company
              </Card.Title>
              <Card.Description className="text-sm text-muted">
                Enter your details below to request a CVerify business account.
              </Card.Description>
            </CardHeader>
            <CardContent className="w-full p-0">
              <Form className="flex flex-col gap-5" onSubmit={onRegisterSubmit}>
                <TextField isRequired name="companyName" type="text">
                  <Label className="text-sm font-medium text-foreground/80 pb-1">
                    Company Name
                  </Label>
                  <Input
                    placeholder="Enter company name"
                    className="h-12"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                  <FieldError />
                </TextField>

                <TextField isRequired name="taxCode" type="text">
                  <Label className="text-sm font-medium text-foreground/80 pb-1">
                    Tax Code
                  </Label>
                  <Input
                    placeholder="Enter your 10-digit tax code"
                    className="h-12"
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                  />
                  <FieldError />
                </TextField>

                <TextField
                  isRequired
                  name="companyEmail"
                  type="email"
                  isInvalid={isCompanyEmailInvalid}
                >
                  <Label className="text-sm font-medium text-foreground/80 pb-1">
                    Company Email
                  </Label>
                  <Input
                    placeholder="Enter company email"
                    className="h-12"
                    value={companyEmail}
                    onChange={(e) => {
                      setCompanyEmail(e.target.value);
                      setCompanyEmailTouched(true);
                    }}
                    onBlur={() => setCompanyEmailTouched(true)}
                  />
                  {isCompanyEmailInvalid && (
                    <div className="text-left w-full mt-1">
                      <ErrorMessage className="text-danger text-xs font-medium">
                        Please enter a valid company email address.
                      </ErrorMessage>
                    </div>
                  )}
                </TextField>

                <div className="flex items-center pb-2">
                  <Checkbox
                    id="terms-agreement"
                    isSelected={acceptTerms}
                    onChange={setAcceptTerms}
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Content>
                      <Label
                        htmlFor="terms-agreement"
                        className="text-xs text-muted cursor-pointer leading-normal"
                      >
                        I agree to the{" "}
                        <Link
                          href="/terms-of-service"
                          className="text-xs inline font-semibold"
                        >
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/privacy-policy"
                          className="text-xs inline font-semibold"
                        >
                          Privacy Policy
                        </Link>
                      </Label>
                    </Checkbox.Content>
                  </Checkbox>
                </div>

                <div className="flex gap-4 mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    className="h-12 rounded-xl"
                    onPress={() => {
                      setSelectedTab("analytics");
                      setShowRegistration(false);
                    }}
                  >
                    Back to Sign In
                  </Button>
                  <Button
                    type="submit"
                    fullWidth
                    className="h-12 rounded-xl bg-foreground text-background font-semibold"
                    isDisabled={
                      isCompanyEmailInvalid ||
                      !companyName ||
                      !taxCode ||
                      !companyEmail ||
                      !acceptTerms
                    }
                  >
                    Register
                  </Button>
                </div>
              </Form>
            </CardContent>
          </div>
        </Card>
      )}
    </div>
  );
}
