import type { ReactNode } from 'react';
import logo from '@/assets/logo.png';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  usePageTitle(title);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted p-4 md:p-10">
      <div className="flex items-center gap-2 font-semibold">
        <img src={logo} alt="" className="size-7 rounded-md" />
        eventKit
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle as="h1" className="text-xl">
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
