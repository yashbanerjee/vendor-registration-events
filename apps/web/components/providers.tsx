"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Session = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  vendorId: string | null;
  roles: string[];
  permissions: string[];
};

const SessionContext = createContext<{ session?: Session; loading: boolean; refresh: () => Promise<void> }>({
  loading: true,
  refresh: async () => undefined,
});

export function useSession() {
  return useContext(SessionContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={client}>
      <SessionBoundary>{children}</SessionBoundary>
    </QueryClientProvider>
  );
}

function SessionBoundary({ children }: { children: React.ReactNode }) {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ data: Session }>("/auth/me"),
  });
  const value = useMemo(
    () => ({
      session: query.data?.data,
      loading: query.isLoading,
      refresh: async () => {
        await query.refetch();
      },
    }),
    [query],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
