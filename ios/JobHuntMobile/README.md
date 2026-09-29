# Job Hunt Mobile

Native SwiftUI companion prototype for the hosted Job Hunt Dashboard.

## Current spike

- Mocked Today Queue with pull-to-refresh seam
- Login screen using the hosted session API and Keychain-backed session/CSRF cookies
- Capture screen accepting shared/pasted source text
- Safari Share Sheet extension with `jobhunt://capture` handoff
- Review-before-save flow that preserves original source text
- Local draft store actor for offline-safe drafts
- API client seam for `/api/dashboard` and `/api/pipeline`
- Fallback extractor that works when Foundation Models are unavailable

The hosted API remains the source of truth. The simulator build defaults to `http://127.0.0.1:3001`; set `JobHuntAPIBaseURL` in `AppInfo.plist` or a release-specific configuration to the deployed dashboard URL before device testing. Authentication reuses the existing session and CSRF cookie contract, storing only opaque cookie values in Keychain.

The Share Sheet extension accepts a job URL or text and routes it into the capture/review flow. A real Safari/Share Sheet test still requires launching the app on a simulator or device with Safari content available.

## Toolchain

Deployment target: iOS 26.0, Swift 6 language mode, Xcode 26 or newer.
