"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DASHBOARD_PASSWORD =
  process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD ?? "sharper2026";

const AUTH_KEY = "sharper:authed";

interface Props {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export function PasswordGate({
  title = "Dashboard",
  description = "Enter the password to access the digest.",
  children,
}: Props) {
  const [authenticated, setAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  // Read persisted auth once on mount. sessionStorage keeps the gate open
  // across date navigation but clears when the tab closes.
  useEffect(() => {
    try {
      setAuthenticated(window.sessionStorage.getItem(AUTH_KEY) === "1");
    } catch {
      setAuthenticated(false);
    }
    setReady(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === DASHBOARD_PASSWORD) {
      try {
        window.sessionStorage.setItem(AUTH_KEY, "1");
      } catch {
        // sessionStorage unavailable; stay authed for this render only.
      }
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  // Avoid flashing the password form before we've read sessionStorage.
  if (!ready) return null;
  if (authenticated) return <>{children}</>;

  return (
    <div className="max-w-md mx-auto px-4 py-24 animate-fade-up">
      <p className="text-xs font-mono tracking-[0.3em] uppercase text-brand mb-3 text-center">
        Private
      </p>
      <h2 className="font-heading text-2xl font-bold tracking-tight text-center mb-2">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-8">
        {description}
      </p>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-mono uppercase tracking-wider"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">
                Incorrect password. Try again.
              </p>
            )}
            <Button type="submit" className="w-full">
              Access Dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
