/** Live money data layer (linked accounts). See ./config.ts for switching mock ↔ real backend. */
export * from './types';
export * from './freshness';
export { CONNECTIONS_COPY, CONNECTION_STATUS_LABEL, HOME_LINK_COPY } from './copy';
export { MockMoneyClient, MOCK_INSTITUTIONS, type SavedConnection } from './MockMoneyClient';
export { HttpMoneyClient, itemToConnection, mapItemStatus, summaryToMoneyData } from './HttpMoneyClient';
export { openPlaidLink, isMockLinkToken, type PlaidLinkResult } from './plaidLink';
export { createMoneyClient, getMoneyClient, readMoneyConfig, setMoneyAccessTokenProvider, setMoneyClient } from './config';
export { selectHomeData, selectLiveData, useConnections } from './store';
