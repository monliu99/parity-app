import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";

interface SynthesisCardProps {
  insight: string;
}

export function SynthesisCard({ insight }: SynthesisCardProps) {
  if (!insight) return null;

  // Split by ||| first, fallback to newlines if not found
  let bullets: string[];
  if (insight.includes("|||")) {
    bullets = insight.split("|||").map(b => b.trim()).filter(Boolean);
  } else {
    // Fallback: split by sentence endings
    bullets = insight.split(/(?<=[.!?])\s+/).map(b => b.trim()).filter(Boolean);
  }

  // Extract label from each bullet (format: [Label] text)
  const parsedBullets = bullets.map(bullet => {
    const match = bullet.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (match) {
      return { label: match[1], text: match[2] };
    }
    return { label: null, text: bullet };
  });

  return (
    <Card className="shadow-card">
      <CardContent className="pt-5 pb-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Parity&apos;s take
        </p>
        <ul className="space-y-2">
          {parsedBullets.map((bullet, i) => (
            <li key={i} className="text-sm leading-relaxed text-foreground flex gap-2">
              <span className="text-moss mt-0.5">•</span>
              <span>
                {bullet.label && (
                  <span className="font-semibold text-muted-foreground">{bullet.label}: </span>
                )}
                {bullet.text}
              </span>
            </li>
          ))}
        </ul>
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
