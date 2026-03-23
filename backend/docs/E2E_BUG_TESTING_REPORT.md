# End-to-End Bug Testing Report

**Date:** March 22, 2026  
**Tester:** Codex  
**Application:** PrintFree / Exness Payment App  
**Environment:** Local Flask app with live MongoDB-backed flows

## Summary

This report covers a live end-to-end test pass across the main user and admin workflows using temporary test data and cleanup after execution.

**Checks executed:** 42  
**Confirmed bugs:** 3

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 1 |
| Medium | 1 |

## Test Coverage

The following flows were executed successfully unless noted in the findings section:

- Landing page, sign-in page, and register page load
- Anonymous redirect protection for authenticated pages
- User registration
- Duplicate registration handling
- User sign-in with valid and invalid credentials
- Account count retrieval
- Trading account creation
- Max 3 account limit enforcement
- Deposit initiation validation
- Screenshot upload validation
- Deposit submission to admin
- Admin sign-in
- Admin notification retrieval
- Deposit approval
- Manual balance update
- Withdrawal credential save/load
- Withdrawal initiation validation
- Withdrawal rejection
- User notification retrieval
- User/admin chat exchange
- Testimonial submission
- Duplicate testimonial protection
- Admin account detail update

## Findings

### 1. Anonymous users can submit a payment for admin approval

**Severity:** Critical  
**Endpoint:** `POST /api/payment/simulate/<payment_id>`  
**Location:** [app.py](/c:/YASH/Projects/Exness%20Payment%20App/backend/app.py:1684)

#### Description
The payment simulation endpoint does not verify authentication or ownership of the payment record before marking the payment as submitted and generating an admin notification.

#### Reproduction
1. Register and sign in as a normal user.
2. Create an account.
3. Initiate a deposit.
4. Upload a valid screenshot for that deposit.
5. From an anonymous session, call `POST /api/payment/simulate/<payment_id>`.

#### Actual Result
The anonymous request succeeds with:

```json
{"success": true}
```

An admin notification is created for that payment.

#### Expected Result
Only the authenticated owner of the payment, or an explicitly authorized admin/system flow, should be able to submit the payment for review.

#### Impact
- Unauthorized users can advance payment workflow state
- Predictable or leaked payment IDs could be abused
- Admins may receive fraudulent payment submissions

#### Recommended Fix
- Require authentication in `simulate_payment`
- Verify `payment.user_id == current_user._id`
- Reject anonymous and cross-user access with `401` or `403`

---

### 2. Admin unread chat counters include the admin's own replies

**Severity:** High  
**Endpoints:**  
- `POST /api/chat/send`  
- `GET /api/chat/unread-count`  
- `GET /api/chat/admin-users`  
- `GET /api/admin/chat-users-with-pending`

**Locations:**  
- [app.py](/c:/YASH/Projects/Exness%20Payment%20App/backend/app.py:2599)  
- [app.py](/c:/YASH/Projects/Exness%20Payment%20App/backend/app.py:2612)  
- [app.py](/c:/YASH/Projects/Exness%20Payment%20App/backend/app.py:2724)  
- [app.py](/c:/YASH/Projects/Exness%20Payment%20App/backend/app.py:2754)  
- [app.py](/c:/YASH/Projects/Exness%20Payment%20App/backend/app.py:2772)

#### Description
Admin-sent chat messages are stored with `read: false`. The unread aggregations count all unread messages for the admin thread without distinguishing whether the sender was the user or the admin.

#### Live Reproduction
1. User sends a chat message to admin.
2. Admin unread list correctly shows the user thread.
3. Admin opens the thread; unread count clears.
4. Admin sends a reply.
5. The same thread appears as unread again for the admin.

#### Actual Result
The admin’s own reply is treated as unread work for the admin dashboard.

#### Expected Result
Only user-to-admin unread messages should contribute to admin unread counters.

#### Impact
- False pending-chat indicators
- Misleading dashboard/admin workload numbers
- Support workflow noise

#### Recommended Fix
- Mark admin-sent messages as `read: true`, or
- Update unread aggregations to count only messages where `sender_id != admin._id`

---

### 3. Frontend email-domain rules do not match backend configuration

**Severity:** Medium  
**Locations:**  
- [signin.js](/c:/YASH/Projects/Exness%20Payment%20App/backend/static/js/signin.js:46)  
- [register.js](/c:/YASH/Projects/Exness%20Payment%20App/backend/static/js/register.js:46)  
- [app.py](/c:/YASH/Projects/Exness%20Payment%20App/backend/app.py:1062)

#### Description
Frontend validation allows `gmail.com` and `company.com`, while the backend is currently configured to allow only `gmail.com`.

#### Actual Result
A `company.com` email can pass client-side validation and still fail on the server.

#### Expected Result
Frontend and backend should use the same allowed-domain list.

#### Impact
- Confusing registration/sign-in UX
- Client-side validation does not reflect actual server behavior

#### Recommended Fix
- Serve allowed domains from the backend to the frontend, or
- Generate the frontend validation config from the same backend source

## Passed End-to-End Checks

- Anonymous access to `/my-accounts` redirects to `/signin`
- Registration works for a valid new user
- Duplicate registration is blocked
- Invalid password sign-in is blocked
- Valid sign-in succeeds
- Account count starts at zero for a new user
- First three account creations succeed
- Fourth account creation is blocked by the 3-account cap
- Deposit validation rejects below-minimum IMPS amount
- Screenshot is required before payment submission
- Invalid screenshot extension is rejected
- Valid screenshot upload succeeds
- Admin can retrieve pending payment notifications
- Admin can approve deposits
- User sees approved deposit in notifications
- Admin can update account balance
- Withdrawal credentials can be saved and reloaded
- Withdrawal validation rejects below-minimum UPI amount
- Valid withdrawal request succeeds
- Admin can retrieve pending withdrawal notifications
- Admin can reject withdrawals
- User sees rejected withdrawal in notifications
- User can send chat messages
- Admin can reply in chat
- User can retrieve chat history
- User can submit a testimonial
- Duplicate testimonial submission is blocked
- Admin can update account leverage

## Notes

- Testing was executed with temporary user data and cleaned up after the run.
- Google OAuth flow was not exercised.
- External payment gateway/webhook integrations were not exercised beyond internal route behavior.
- Browser-level UI automation was not run in this pass.
