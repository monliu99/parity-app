import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";

interface SynthesisCardProps {
  insight: string;
}

export function SynthesisCard({ insight }: SynthesisCardProps) {
  if (!insight) return null;

  return (
    <Card className="shadow-card">
      <CardContent className="pt-5 pb-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Parity&apos;s take
        </p>
        <p className="text-sm leading-relaxed text-foreground">{insight}</p>
        <Link
          href="/chat"
          className="text-sm text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1"
        >
          Ask a follow-up
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
