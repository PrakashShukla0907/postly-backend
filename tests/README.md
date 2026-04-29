# Postly - Testing Suite

This directory contains integration and unit tests for the Postly backend.

## Running Tests

Ensure your local environment is set up (PostgreSQL and Redis running via Docker).

### Run all tests
```bash
npm test
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests in watch mode
```bash
npm run test:watch
```

## Tools Used
- **Jest**: Testing framework
- **Supertest**: For HTTP assertions
- **Prisma**: To seed/reset the test database
