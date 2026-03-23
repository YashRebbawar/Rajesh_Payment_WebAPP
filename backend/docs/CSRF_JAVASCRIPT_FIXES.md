# CSRF Token JavaScript Fixes - Complete

## Issue
The CSRF tokens were added to HTML forms, but the JavaScript fetch requests were not including the tokens in the request headers, causing "The CSRF token is missing" errors.

## Solution
Updated all JavaScript files that make POST requests to extract the CSRF token from the form and include it in the `X-CSRFToken` header.

## Files Updated

### 1. register.js
**Location:** `backend/static/js/register.js`
**Change:** Extract CSRF token and add to fetch headers
```javascript
// Before:
const data=Object.fromEntries(new FormData(this));
const res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});

// After:
const formData = new FormData(this);
const csrfToken = formData.get('csrf_token');
const data=Object.fromEntries(formData);
delete data.csrf_token;
const res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrfToken},body:JSON.stringify(data)});
```

### 2. signin.js
**Location:** `backend/static/js/signin.js`
**Changes:** Updated both signin and forgot-password form submissions
```javascript
// Sign-in form:
const formData = new FormData(this);
const csrfToken = formData.get('csrf_token');
const data=Object.fromEntries(formData);
delete data.csrf_token;
const res=await fetch('/api/signin',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrfToken},body:JSON.stringify(data)});

// Forgot-password form:
const formData = new FormData(this);
const csrfToken = formData.get('csrf_token');
const data=Object.fromEntries(formData);
delete data.csrf_token;
const res=await fetch('/api/forgot-password',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrfToken},body:JSON.stringify(data)});
```

### 3. account-setup.js
**Location:** `backend/static/js/account-setup.js`
**Change:** Extract CSRF token and add to fetch headers
```javascript
// Before:
fetch('/api/account-setup', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(formData)
})

// After:
const formDataObj = new FormData(setupForm);
const csrfToken = formDataObj.get('csrf_token');
fetch('/api/account-setup', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body:    JSON.stringify(formData)
})
```

## How It Works

1. **Extract CSRF Token**: Get the token from the form using `FormData.get('csrf_token')`
2. **Remove from Data**: Delete the token from the data object before sending JSON
3. **Add to Headers**: Include the token in the `X-CSRFToken` header
4. **Server Validation**: Flask-WTF automatically validates the token on the server

## Protected Endpoints

✅ `/api/register` - User registration
✅ `/api/signin` - User login
✅ `/api/forgot-password` - Password reset
✅ `/api/account-setup` - Account creation

## Testing

To verify CSRF protection is working:

1. **Test with valid token:**
   - Forms will submit successfully with the CSRF token in headers

2. **Test without token:**
   - Requests without CSRF token will be rejected with 400 Bad Request
   - Error: "The CSRF token is missing"

3. **Test with invalid token:**
   - Requests with invalid CSRF token will be rejected with 400 Bad Request
   - Error: "The CSRF token is invalid"

## Status: ✅ COMPLETE

All JavaScript files that make POST requests now properly extract and include CSRF tokens in the request headers. The application is now fully protected against Cross-Site Request Forgery attacks.
