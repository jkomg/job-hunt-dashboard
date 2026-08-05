# Job Hunt Mobile

Native SwiftUI companion prototype for the hosted Job Hunt Dashboard.

## Current spike

- Mocked Today Queue with pull-to-refresh seam
- Capture screen accepting shared/pasted source text
- Review-before-save flow that preserves original source text
- Local draft store actor for offline-safe drafts
- API client seam for `/api/dashboard` and `/api/pipeline`
- Fallback extractor that works when Foundation Models are unavailable

The hosted API remains the source of truth. The placeholder API URL in `JobHuntAPI.swift` must be replaced with the deployed dashboard URL before device testing. Authentication and idempotent mobile mutation handling are intentionally the next backend integration step.

## Toolchain

Deployment target: iOS 26.0, Swift 6 language mode, Xcode 26 or newer.
