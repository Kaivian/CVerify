"use client";

import React, { useEffect } from "react";

export default function GoogleCallbackPage() {
  useEffect(() => {
    try {
      // Extract the id_token from the URL fragment (hash)
      // Google redirects with a URL fragment like: #id_token=...&state=...
      const hash = window.location.hash;
      if (!hash) {
        // Check if there is error in query params
        const params = new URLSearchParams(window.location.search);
        const error = params.get("error");
        if (error) {
          window.opener?.postMessage(
            { type: "GOOGLE_OAUTH_ERROR", error },
            window.location.origin
          );
        } else {
          window.opener?.postMessage(
            { type: "GOOGLE_OAUTH_ERROR", error: "No token returned." },
            window.location.origin
          );
        }
        window.close();
        return;
      }

      // Parse URL fragment
      const params = new URLSearchParams(hash.substring(1)); // strip the leading #
      const idToken = params.get("id_token");
      const error = params.get("error");

      if (idToken) {
        window.opener?.postMessage(
          { type: "GOOGLE_OAUTH_SUCCESS", idToken },
          window.location.origin
        );
      } else {
        window.opener?.postMessage(
          { type: "GOOGLE_OAUTH_ERROR", error: error || "Failed to parse token." },
          window.location.origin
        );
      }
    } catch (e) {
      console.error("Error handling Google OAuth callback:", e);
      window.opener?.postMessage(
        { type: "GOOGLE_OAUTH_ERROR", error: "An unexpected error occurred." },
        window.location.origin
      );
    } finally {
      window.close();
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center select-none">
      <div className="w-8 h-8 border-2 border-t-foreground border-border rounded-full animate-spin mb-4" />
      <p className="text-sm font-semibold text-foreground">Completing Google Authentication...</p>
      <p className="text-xs text-muted mt-1">This window will close automatically.</p>
    </div>
  );
}
