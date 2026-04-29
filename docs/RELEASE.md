# Release Guide

## Goal

Ship a stable release that non-technical users can run locally with Docker and local persistence.

## Release Target

- Version: `v1.0.0`
- Primary install path: Docker local mode (`scripts/start-local-docker.sh`)
- Optional paths: Cloud Run, legacy Notion import

## Next Release Track

The next major release track is the Remote Rebellion hosted platform shift:

- Multi-tenant data model with `Remote Rebellion` as the first organization
- Job seeker, staff, and admin roles
- RR staff workspace for adding jobs and flagging follow-ups
- Database-first job intake
- Google Sheets as import/export/backup, not the source of truth
- Low-cost Cloud Run deployment by default

See [RR_PLATFORM_RELEASE_PLAN.md](./RR_PLATFORM_RELEASE_PLAN.md).

## Pre-Release Checklist

1. Validate local easy install from scratch:
   - clone repo
   - run `./scripts/start-local-docker.sh`
   - confirm login and data persistence after restart
2. Validate core API flows (pipeline, contacts, interviews, events, templates, watchlist, daily).
3. Validate docs:
   - README quick start
   - scripts README
   - `.env.example`
4. Validate cloud path still deploys (if publishing hosted option).
5. Confirm changelog is updated.

## Cut Release

```bash
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

Create a GitHub Release with:

- Title: `v1.0.0`
- Notes summary:
  - Docker local-first setup
  - Turso-backed full app runtime
  - Optional Google Sheets sync
  - Optional Notion import tool

## Recommended User-Facing Release Notes

- “No paid tools required for local use.”
- “Install with Docker in one command path.”
- “Data stays on your machine by default.”
- “Google Sheets sync is optional.”
