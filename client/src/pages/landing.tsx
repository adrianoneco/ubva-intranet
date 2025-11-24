import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-3xl mx-4">
        <CardContent className="p-8">
          <div className="flex flex-col items-start gap-4">
            <h1 className="text-3xl font-bold">Welcome</h1>
            <p className="text-sm text-muted-foreground">This is the landing page. Navigate to the app to see the dashboard.</p>
            <div className="pt-4">
              <Button asChild>
                <a href="/">Go to App</a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
