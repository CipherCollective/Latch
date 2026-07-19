import type { SpendRequest } from '../types/domain';

export const CODE_SHIELD_REQUEST: SpendRequest = {
  requestNonce: 'req-codeshield-001',
  serviceId: 'codeshield',
  serviceName: 'CodeShield security report',
  amount: '12',
  category: 'developer-tools',
  merchant: {
    merchantId: 'merchant-codeshield',
    displayName: 'CodeShield',
    metaAddress: 'demo-meta:codeshield',
  },
};

export const ALPHA_SIGNAL_REQUEST: SpendRequest = {
  requestNonce: 'req-alphasignal-001',
  serviceId: 'alphasignal',
  serviceName: 'AlphaSignal trading dataset',
  amount: '30',
  category: 'trading-data',
  merchant: {
    merchantId: 'merchant-alphasignal',
    displayName: 'AlphaSignal',
    metaAddress: 'demo-meta:alphasignal',
  },
};
