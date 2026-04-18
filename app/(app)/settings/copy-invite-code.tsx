"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

export function CopyInviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-2xl font-bold tracking-widest">
        {code}
      </span>
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}
