const jestExpoPreset = require('jest-expo/jest-preset')

module.exports = {
  ...jestExpoPreset,
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    ...jestExpoPreset.moduleNameMapper,
  },
}
