import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <h1
            className="text-7xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            Parity
          </h1>
          <p className="text-2xl text-muted-foreground leading-relaxed">
            See your finances together.
            <br />
            Plan together.
          </p>
          <p className="text-base text-muted-foreground/70">
            AI-powered financial coordination for couples.
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }), "px-8 h-12 text-base")}
          >
            Get started
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-8 h-12 text-base")}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
