export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/migrations/'],
  moduleFileExtensions: ['js'],
  extensionsToTreatAsEsm: ['.js']
};
