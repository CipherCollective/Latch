import type { CreateCapabilityInput } from '../types/domain';

export const DEFAULT_CAPABILITY_INPUT: CreateCapabilityInput = {
  alias: 'Research procurement',
  policy: {
    agentName: 'Research Agent A',
    perTransactionLimit: '20',
    totalBudget: '50',
    maxUses: 3,
    allowedCategory: 'developer-tools',
  },
};

