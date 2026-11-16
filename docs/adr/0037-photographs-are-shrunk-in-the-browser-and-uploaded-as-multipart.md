# 0037. Shrink photographs in the browser and upload them as multipart through the generated client

- Status: accepted
- Date: 2026-11-15
- Session: F6b

## Context

A death or cull at or above 50,000 pesewas must carry a photograph when it is reported (contract 1.24.0, `MORTALITY_PHOTO_REQUIRED`), and there is no way to add one later. F6 could not attach one: the generated client sent JSON only (ADR 0018), and the contract's one file operation, `uploadFile` (`POST /files`), takes `multipart/form-data`. A-F6-03 left this for the owner, who answered: build a shared upload field in `packages/ui` on the contract's existing upload flow, opening the camera on a phone, and shrink photographs in the browser so the upload works on 3G.

A phone camera writes 4 to 12 MB per picture. The contract caps images at 5 MB, so many pictures would be refused, and at 3G speeds (about 400 kbit/s up) the rest would take minutes.

## Options considered

1. **Teach the generated client multipart.** `uploadFile` is typed from the contract like every other operation, and it gets the idempotency key, the CSRF token, the timeout and the 401 refresh from `call()`. The cost is a generator change.
2. **A hand-written `fetch` for uploads.** Fast to write, but it breaks the rule that nothing but `call()` calls `fetch`, and it would repeat the headers and the refresh by hand.
3. **Upload the original and let the server shrink it.** The server already re-encodes product photographs, but only after the whole file has crossed the slow link. It fails the 3G requirement.

## Decision

- **The generator marks each operation's body** as `json`, `multipart` or `none` (`operationManifest[op].body`). It types every `format: binary` property as `Blob`, through openapi-typescript's `transform`. `typescript` becomes a dev dependency of `packages/api-client` for that, at the root's version.
- **`call()` builds the form.** For a `multipart` operation it turns the body object into `FormData`: a `Blob` becomes a file part, named when it is a `File`, and anything else is text. The browser writes the boundary. Everything else about the call is unchanged.
- **`PhotoInput` in `packages/ui`** is the shared field:
  - **The control is the native file input** (`accept="image/*"`, `capture`), laid transparently over a button face. A tap opens the camera, the keyboard reaches it, and `Field` names it.
  - **It shrinks before sending** (`resizePhoto`): the longest edge goes to 1,600 px, the picture is turned upright from its EXIF orientation, and it is encoded as JPEG at quality 0.8. That is typically 150 to 400 KB. Where the browser cannot decode the picture, the original goes, and the server's checks decide.
  - **The upload is the app's.** The app passes `upload(file) => Promise<fileId>` (its `useApiMutation('uploadFile')`) and gets the failure through `onUploadError`, to show as the Field's error. `packages/ui` never calls the API.
- **Purposes:** a death's photograph is uploaded with purpose `EVIDENCE`, the purpose whose allow-list takes images (CR-022 asks the backend to confirm it).

## Consequences

- **Any later multipart operation works with no client change.** A contract that adds one regenerates the row and the type.
- **Proof of delivery and signatures (F11) reuse `PhotoInput`,** with their own purposes.
- **A shrunk photograph is still a person's evidence.** The approver sees the server's copy through a signed, expiring link (`createFileSignedUrl`), once it is `CLEAN`, never the device's.
- **Revisit** if the contract adds a direct-to-storage upload (a signed upload URL), or if 1,600 px proves too small to read an ear tag.
