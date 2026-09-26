/** Pure-logic tests (src/game, src/lib, src/data) run under jest-expo's node-friendly preset. */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  // ../packages/screener source resolves Babel helpers from this app's node_modules.
  moduleNameMapper: { '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1' },
  testMatch: ['**/__tests__/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|zustand)',
  ],
};
