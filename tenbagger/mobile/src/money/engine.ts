/**
 * Money engine adapter. The real logic lives in tenbagger/packages/money (pure TS, no deps),
 * consumed exactly like ../lib/screener.ts consumes packages/screener: Metro bundles the package
 * source (metro.config.js watches ../packages), Jest maps @babel/runtime, and tsconfig's
 * allowImportingTsExtensions lets the package's `.ts` imports typecheck. Screens import from here.
 */
export * from '../../../packages/money/src/index';
