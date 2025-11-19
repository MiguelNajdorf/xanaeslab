# AGENTS.md - Xanaes Lab

## Build/Lint/Test
- `npm start` - Start development server with http-server
- `npm test` - Run smoke tests (structure validation)
- `npm run build:android` - Build Android app with Capacitor
- `npm lint` - Currently not configured
- Quick single-test: use a tiny inline Node snippet to verify a single file, e.g.
- `node -e "require('fs').existsSync('www/index.html') ? console.log('OK') : console.error('missing')"`

## Code Style
- Imports: ES modules with named imports, group related imports
- Naming: Spanish comments, camelCase for variables/functions, PascalCase for classes
- Error Handling: Try/catch blocks, user-friendly Spanish error messages
- Formatting: Consistent indentation, meaningful variable names, nullish coalescing `??`
- Types: JavaScript with JSDoc comments, no TypeScript detected
- API: Centralized API client with token-based auth, rate limiting implemented
- Storage: LocalStorage for persistence, IndexedDB for caching
- Testing: Smoke tests validate file structure, run with `npm test`

Cursor/Copilot Guidelines
- Cursor rules: none detected
- Copilot instructions: none detected