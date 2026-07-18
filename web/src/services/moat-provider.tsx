import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MoatClient } from './moat-client';
import { MockMoatClient } from './mock-moat-client';

const MoatContext = createContext<MoatClient | null>(null);

export function MoatProvider({ children }: { children: ReactNode }) {
  const [client] = useState<MoatClient>(() => new MockMoatClient());
  return <MoatContext.Provider value={client}>{children}</MoatContext.Provider>;
}

export function useMoatClient(): MoatClient {
  const client = useContext(MoatContext);
  if (!client) throw new Error('useMoatClient must be used within MoatProvider.');
  return client;
}

