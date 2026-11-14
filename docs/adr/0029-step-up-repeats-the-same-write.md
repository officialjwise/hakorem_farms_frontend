# 0029. Step up on the server's 403 and repeat the same write

- Status: accepted (owner, 2026-11-14, approved as built)
- Date: 2026-11-14
- Session: F3

## Context

FR-IAM-007 and FR-IAM-022 require a TOTP code, entered on the same session in the last five minutes, before role and grant changes and before creating a user or resetting a password. API.md 3.4 describes the flow:

1. The server answers 403 `STEP_UP_REQUIRED`.
2. The client asks for a code and calls `POST /auth/step-up`.
3. The client repeats the request with the same `Idempotency-Key`.

The contract says which operations need it only in prose, so the generated operation table cannot tell the client beforehand (CR-007).

## Options considered

1. **Ask for a code before every such write.** The client cannot know which writes need one, and it would ask again inside the five minutes when no code is needed.
2. **Handle `STEP_UP_REQUIRED` inside the data layer, like the 401 single flight.** The data layer holds no words and opens no dialogs, and a step-up needs a person to type a code.
3. **A hook in the console, `useStepUp()`.** It wraps the one write as `run(attempt)`. On the 403 it opens a dialog for the code, steps the session up through `AuthProvider`, and runs `attempt` again.

## Decision

Option 3.

- `AuthClient` and `AuthProvider` gain `stepUp(code)`. It adopts the session the server answers with, which carries a new `steppedUpAt` and possibly a new CSRF token.
- `useStepUp().run(attempt)` resolves with the write's answer, or with `null` when the person cancels the code. Any other failure rejects, as the write itself would.
- `attempt` reuses its idempotency key: screens take the key from `useIntentKey(body)`, so the repeat is the same intent (DATA_CONVENTIONS). A changed body gets a new key.
- `shownFailure(error)` hides the 403 `STEP_UP_REQUIRED` from `MutationFailure`. Without it, the failure view would read the 403 as "permission denied" while the dialog is asking for the code.
- The dialog is built from `Dialog` and the form system. It holds only the one write waiting for its code; it is not a provider and adds no context.
- A wrong code keeps the dialog open with the server's message.

## Consequences

- The first protected write in a five-minute window costs one round trip more (the 403). Later writes in the window go straight through, and the e2e suite proves it.
- If the contract gains `x-requires-step-up` (CR-007), the hook can ask before the write without changing its callers.
- A user without TOTP gets 403 `TOTP_ENROLMENT_REQUIRED` from `stepUp`. The dialog shows the server's message, and enrolment waits for CR-006.
