import React from "react";
import { DemoContainer } from "./components/DemoContainer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CVerify - Interactive Demo Experience",
  description: "Explore the official CVerify interactive product showcase and witness instant credential verification in action.",
};

export default function DemoPage() {
  return <DemoContainer />;
}
