"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);

  const githubLoginUrl = new URL("/auth/github/login", env.NEXT_PUBLIC_LLM_BASE_URL);
  githubLoginUrl.searchParams.set(
    "next",
    `${env.NEXT_PUBLIC_MONITORING_BASE_URL}/`,
  );

  return (
    <div className="grid gap-4">
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      <Button
        type="button"
        onClick={() => {
          // Leave errors visible, but clear stale ones on interaction.
          setError(null);
          window.location.href = githubLoginUrl.toString();
        }}
      >
        Login with GitHub
      </Button>
    </div>
  );
}
