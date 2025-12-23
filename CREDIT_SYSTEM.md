# Class Credits System - Implementation Guide

## Overview
This system manages `class_credits` deductions/refunds when clients are assigned to class-type events.

**Implementation**: Frontend-based credit management via [creditManager.ts](src/lib/creditManager.ts)

## Architecture Decision: Frontend vs Backend

### Current Implementation: Frontend-based ✅

**Pros:**
- Works immediately without server configuration
- Easy to debug (browser console)
- Transparent - see exactly when credits adjust
- Flexible - modify logic without touching backend
- Perfect for low-concurrency scenarios

**Cons:**
- **Race conditions possible** if multiple users edit same client simultaneously
  - Example: Two users book same client → both read `credits: 5` → both write `credits: 4` → one deduction lost
  - **Probability**: Very low for small gyms with few concurrent operations
- **Not atomic** - if credit update fails, event is already created
  - Mitigation: Errors are logged for manual correction
- **Client-dependent** - if browser crashes before credit update completes, credits not adjusted
  - **Probability**: Very low (operations are fast)

**Recommendation**: Frontend implementation is sufficient for small-to-medium applications with low concurrency. For high-traffic scenarios with many concurrent bookings, consider server-side implementation (PocketBase hooks or custom API).

---

## Rules
1. **Create class event**: Deduct 1 credit per assigned client
2. **Delete class event**: Refund 1 credit per assigned client
3. **Update event**:
   - Type change (class → non-class): Refund 1 per client
   - Type change (non-class → class): Deduct 1 per client
   - Client list change (type=class): Diff-based (new clients -1, removed clients +1)
4. **Propagate templates**: Batch deduct credits (aggregate per client across all created events)
5. **Negative credits allowed**
6. **Default**: null/missing `class_credits` treated as 0

---

## Frontend Implementation

The credit system is managed directly in the frontend via helper functions in [src/lib/creditManager.ts](src/lib/creditManager.ts):

### Core Functions

- **`onEventCreate(eventData)`**: Deducts credits when creating a class event
- **`onEventUpdate(oldData, newData)`**: Handles diff-based credit adjustments on updates
- **`onEventDelete(eventData)`**: Refunds credits when deleting a class event
- **`onBatchEventsCreate(eventsData)`**: Efficiently processes bulk credit adjustments for propagation

### Integration Points

1. **[EventDialog.tsx](src/components/eventos/EventDialog.tsx)**:
   - Calls `onEventCreate()` after creating events
   - Calls `onEventUpdate()` before updating events
   - Calls `onEventDelete()` before deleting events
   - Shows client credit balance in dropdown

2. **[ClassSlotDialog.tsx](src/components/clases/ClassSlotDialog.tsx)**:
   - Shows client credit balance in dropdown
   - Templates don't consume credits (only when propagated)

3. **[PropagateDialog.tsx](src/components/clases/PropagateDialog.tsx)**:
   - Calls `onBatchEventsCreate()` after propagating all events
   - Aggregates credit changes per client for efficiency
   - Shows credit preview before propagation

---

## Testing Checklist

- [ ] Create class event with 2 clients → both lose 1 credit
- [ ] Delete that event → both gain 1 credit back
- [ ] Edit class event: add 1 client, remove 1 → correct diff applied
- [ ] Change event type (class → appointment) → all clients refunded
- [ ] Change event type (appointment → class) → all clients deducted
- [ ] Propagate template with 3 clients over 4 weeks → 12 credits deducted per client
- [ ] Verify negative credits work (client with 0 can still be assigned)
- [ ] Verify professionals are unaffected (only clients adjusted)

---

## How It Works

### Example Flows

**Creating a class event with 2 clients:**
```
1. User creates class event → assigns Client A & B
2. Event saved to PocketBase
3. creditManager.onEventCreate() runs:
   - Fetches Client A → credits: 10 → updates to 9
   - Fetches Client B → credits: 5 → updates to 4
4. Console logs: "💳 Client A: 10 → 9" & "💳 Client B: 5 → 4"
```

**Editing a class event (removing 1 client, adding 1):**
```
1. User edits event → removes Client A, adds Client C
2. creditManager.onEventUpdate() calculates diff:
   - Removed: [Client A] → refund +1
   - Added: [Client C] → deduct -1
3. Updates applied before saving event
4. Event saved to PocketBase
```

**Propagating template with 3 clients over 4 weeks:**
```
1. User propagates template → 4 events created
2. PropagateDialog collects all events
3. creditManager.onBatchEventsCreate() aggregates:
   - Client A appears in 4 events → total: -4 credits
   - Client B appears in 4 events → total: -4 credits
   - Client C appears in 4 events → total: -4 credits
4. One update per client (efficient!)
```

---

## Implementation Notes

- **Race conditions**: Possible but unlikely in small gyms with low concurrency
- **Error handling**: Failed credit updates are logged but don't block event operations
- **Performance**: Batch operations aggregate changes per client (1 update per client instead of N updates)
- **Audit trail**: Credit changes are logged to console (can be extended to database)

## Future Enhancements

1. **Batch optimization**: For propagation, aggregate all credit changes per client and apply in one update
2. **Audit log**: Track credit changes with timestamps
3. **Credit packages**: Allow purchasing credit bundles
4. **Expiration**: Add expiration dates to credits
