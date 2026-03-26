import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <FileQuestion className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <CardTitle>Page Not Found</CardTitle>
          <CardDescription>
            The page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/">
            <Button>Back to Dashboard</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
