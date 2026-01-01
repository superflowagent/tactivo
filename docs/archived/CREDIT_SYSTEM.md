# Class Credits System — REMOVED

This document described the previous frontend-based credit management implementation.

**Status:** The in-repo implementation (`src/lib/creditManager.ts`) has been removed and replaced with a no-op stub. Credit management will be reimplemented later as a coherent, server-side subsystem to ensure atomic, race-free updates.

If you need to resurrect or redesign the system, please open an issue describing desired semantics (atomicity, audit logs, race handling, and whether credits are stored in `profiles` or a dedicated table).
