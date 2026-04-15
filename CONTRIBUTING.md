# Contributing

Thanks for your interest in contributing to Job Hunt Dashboard.

## Getting started

1. Fork the repo and clone it locally
2. Follow the setup steps in the README
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Make your changes, then open a pull request against `main`

## Development

```bash
npm install
cp .env.example .env   # fill in your Notion credentials
npm run dev            # runs frontend (port 3000) + server (port 3001) concurrently
```

## Guidelines

- **One feature per PR** — keep changes focused and easy to review
- **Notion schema changes** — if your PR adds a new database or property, document it clearly in the PR description and update `.env.example`
- **No secrets** — never commit `.env` or real API tokens. The `.env` file is gitignored
- **Keep it simple** — this is a personal productivity tool. Avoid over-engineering

## Notion integration

All data lives in Notion. If your feature requires a new database or property:
- Document the schema in your PR
- Update `.env.example` with the new env var
- Update the README setup section

## Reporting bugs

Open an issue using the bug report template. Include steps to reproduce and any relevant server logs.
