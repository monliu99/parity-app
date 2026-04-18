import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="shadow-card max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="flex justify-center">
            <Home className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">Page not found</h2>
          <p className="text-muted-foreground">
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
          <div className="flex justify-center pt-2">
            <Button render={<Link href="/" />}>Go Home</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
