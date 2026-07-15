"use client";

import { createContext } from "react";

/**
 * AuthContext allows overriding the production useAuth hook
 * with mock handlers in demo/preview modes.
 */
export const AuthContext = createContext<unknown>(null);
