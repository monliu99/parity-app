"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signupAction } from "./actions";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillInviteCode = searchParams.get("invite") ?? "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signupAction(formData);

    if (!result.success) {
      setError(result.error ?? null);
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (signInResult?.error) {
      setError("Account created but sign-in failed. Please log in.");
      router.push("/login");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Your name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inviteCode">
            Partner&apos;s invite code{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="inviteCode"
            name="inviteCode"
            placeholder="e.g. BLUE42"
            className="uppercase tracking-widest"
            defaultValue={prefillInviteCode.toUpperCase()}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to start a new partnership and invite your partner later.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span className="text-2xl tracking-tight text-foreground font-heading italic">
            Parity
          </span>
        </div>
        <CardTitle className="text-sm font-bold">Create your account</CardTitle>
        <CardDescription>
          Start managing finances together — or enter a partner&apos;s invite code to join them.
        </CardDescription>
      </CardHeader>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </Card>
  );
}
