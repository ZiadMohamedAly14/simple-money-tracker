// Month tests need a zone far from UTC: at UTC+14 a moment just after local
// midnight is still the previous day in UTC, so code that used UTC dates
// would put it in the wrong Month. Workers inherit this from the parent.
process.env.TZ = 'Pacific/Kiritimati';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
};
