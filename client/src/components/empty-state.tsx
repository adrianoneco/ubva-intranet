"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

interface Props {
  onCreateClick?: () => void;
  title?: string;
  description?: string;
}

export function EmptyState({ onCreateClick, title = "No items yet", description = "Create one to get started." }: Props) {
  return (
    <Card className="w-full">
      <CardContent className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="pt-4">
            <Button onClick={onCreateClick}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Criar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EmptyState;
