# Personal employee accounts

Administrators manage private contact numbers from **حسابات الإداريين**. Saving contact details only merges `config/phones`; it does not create credentials. Phone numbers and passwords must never be committed to this public repository.

The activation button provisions missing Firebase Authentication users in a secondary app, keeping the manager signed in. Usernames use the saved Saudi mobile number; the requested initial password is the same number. Existing passwords are never reset. Existing inactive profiles or conflicting identity links require manual review. No WhatsApp messages are sent automatically.

Personal users sign in at `employee.html`. Their active `employeeProfiles/{uid}` identifies their own accountability records and `e:<name>` PDF acknowledgements. These accounts receive no staff management role. Existing teacher/staff identities, previous receipts and accountability archives remain unchanged.

Deploy `firestore.rules` before activating accounts. Verify contacts and have the account owner complete credential activation in the browser. Tests cover contact parsing, recipient identity preservation and Firestore isolation.
