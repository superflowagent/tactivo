// **CREDIT SYSTEM REMOVED**
// The previous `creditManager` implementation has been intentionally removed.
// Credit management will be reimplemented later in a single, well-designed
// server-side module to avoid race conditions and ensure atomic updates.

// Export no-op functions so code that still imports these helpers doesn't break
// during the transition. Replace with real implementation when reintroducing the
// credit system.

export async function onEventCreate(_: any): Promise<void> {
  return;
}
export async function onEventUpdate(_: any, __: any): Promise<void> {
  return;
}
export async function onEventDelete(_: any): Promise<void> {
  return;
}
export async function onBatchEventsCreate(_: any[]): Promise<void> {
  return;
}
