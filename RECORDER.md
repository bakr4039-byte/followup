# Accountability recorder

`recorder.html` uses a separate email/password identity mapped to a private `accountabilityRecorders/{uid}` profile. It reuses the existing new-accountability form and public schedule names without loading lesson records, personnel profiles, phone directories or accountability history. The recorder supplies a recipient phone when WhatsApp notification is needed.

Only managers provision the profile using **حساب مسؤول الرصد**. Credentials are entered by the account owner/operator at activation, used only for Firebase Authentication, and cleared after success. Passwords are never saved in Firestore or source. Existing accounts with another password are not reset or granted a different role.

Database rules permit an active recorder to create only an initial `sent` draft with an immutable server timestamp and their own creator UID. Read, update, delete, decisions and archives remain unavailable. The manager sees new records in the existing accountability collection. Recording is attributed to the recorder role and actual UID. No existing records or staff access profiles are migrated or changed.

Deploy tested rules before activation. Deactivate a recorder by setting its profile's `active` field to false as a manager.
