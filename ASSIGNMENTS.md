# Personal assignment approvals

`assignment-signing.js` adds the manager's **التكليفات** page and each employee's personal assignments. Import bundles contain private unsigned PDF bytes, a member identifier, a SHA-256 hash and signature rectangles; never commit bundles or employee documents to the public repository.

After validation against the private employee directory, one immutable request is published per employee and PDF hash. Re-import skips published requests and resumes incomplete uploads. The employee signs first, then the educational coordinator (directory member admin-2), then the principal (admin-1). The coordinator/principal's own assignments use two distinct signers. All approvals use personal employee UIDs, not the privileged platform manager identity.

Signers first view the PDF, then draw or upload their own PNG/JPEG/WebP signature. Images are decoded and normalized to a bounded PNG. A preview displays the signature at its assigned position. Explicit personal acknowledgement submits the image, original hash and server timestamp atomically with the counter. Firestore enforces UID ownership, ordering and immutable receipts.

The last approval triggers composition and private final-PDF storage. Every target and the platform manager can retry finalization after a network interruption. Until finalization, the request remains open; archived originals, receipts and PDF parts cannot be modified. Existing accountability and generic document signing flows remain unchanged.

Deploy the tested Firestore rules before importing. The rules grant each active recipient access only to their requests and completed PDFs. No outgoing messages or automatic signatures are generated.
