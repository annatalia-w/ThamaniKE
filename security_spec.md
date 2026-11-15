# Security Specification — ThamaniKE Firestore Fortress Rules

## 1. Data Invariants & Relationship Mapping

1. **Master Source of Truth**: `/users/{userId}` is the root identity document for each authenticated user. Every subcollection document (`/users/{userId}/private/{piiId}` and `/users/{userId}/baskets/{basketId}`) derives access authority from `/users/{userId}` via the Master Gate (`get()` / `getAfter()`).
2. **PII Split-Collection Isolation**: User email addresses are strictly isolated inside `/users/{userId}/private/contact` and never stored on `/users/{userId}`. Both collections forbid `list` queries and restrict `get` strictly to `isOwner(userId)`.
3. **Atomic Profile + PII Creation**: Creating `/users/{userId}` requires synchronous atomic creation of `/users/{userId}/private/contact` in the same batch (`existsAfter`), preventing orphaned profiles without isolated PII records or orphaned PII records without a valid parent profile (`getAfter`).
4. **Verified Identity Enforcement**: All write operations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
5. **Immutable & Temporal Fields**: `uid` and `createdAt` are immutable across all updates; `createdAt` (on create) and `updatedAt` (on create & update) must strictly equal `request.time`.
6. **Bounded Scalar Schema**: Every string has strict `.size()` and regex pattern bounds where applicable; every numeric field is bounded within finite non-negative ranges (`0` to `1,000,000,000` for salary, `0` to `100,000,000` for basket costs).

---

## 2. The "Dirty Dozen" Adversarial Payloads

All 12 payloads below MUST return `PERMISSION_DENIED`:

1. **Identity Spoofing on Profile Create**: Authenticated user `user_A` attempts to create `/users/user_A` with `"uid": "user_B"`.
2. **Cross-Tenant Profile Read (PII / Salary Leak)**: Authenticated user `user_B` attempts `get` on `/users/user_A` or `/users/user_A/private/contact`.
3. **Unverified Email Spoof Write**: Authenticated user `user_A` with `email_verified: false` attempts to `create` `/users/user_A`.
4. **Shadow / Ghost Field Injection on Create**: `user_A` creates `/users/user_A` with all valid fields plus `"isAdmin": true`.
5. **Shadow / Ghost Field Injection on Update**: `user_A` updates `/users/user_A` adding `"role": "superuser"`.
6. **Immortal Field Mutation (`createdAt` / `uid`)**: `user_A` updates `/users/user_A` while altering `createdAt` or `uid`.
7. **Client-Forged Timestamp Attack**: `user_A` creates `/users/user_A` using a past/future client timestamp (`Timestamp.fromMillis(1700000000000)`) instead of `serverTimestamp()` (`request.time`).
8. **Value Poisoning on Whitelisted Update Key**: `user_A` updates `salaryAmount` with `-50000` or `"100000"` (string instead of number) or `salaryType: "hourly"`.
9. **Resource Exhaustion / Oversized String Attack**: `user_A` creates `/users/user_A` with a 5,000-character `fullName` or invalid `workId` containing script tags `<script>`.
10. **Orphaned Profile Without Atomic PII Record**: `user_A` attempts standalone `setDoc` on `/users/user_A` without writing `/users/user_A/private/contact` in the same atomic batch.
11. **Orphaned Basket Subcollection Write Without Parent Master Gate**: `user_A` attempts to create `/users/user_A/baskets/default` when `/users/user_A` does not exist.
12. **Unauthorized Collection Scraping (`list` Query)**: `user_A` executes `getDocs(collection(db, 'users'))` to enumerate users.
