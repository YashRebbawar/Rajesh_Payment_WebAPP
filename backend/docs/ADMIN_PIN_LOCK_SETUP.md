# Admin PIN Lock Setup

## Environment

Set one of these server-side values:

- `ADMIN_SECURITY_PIN=123456`
- `ADMIN_SECURITY_PIN_HASH=<werkzeug password hash>`

Optional controls:

- `ADMIN_PIN_MAX_ATTEMPTS=5`
- `ADMIN_PIN_WINDOW_SECONDS=300`
- `ADMIN_PIN_LOCKOUT_SECONDS=300`
- `ADMIN_PIN_IDLE_TIMEOUT_SECONDS=180`

## Admin User Record

If you want the PIN stored on the admin user document instead of only the environment, run:

```powershell
$env:ADMIN_SECURITY_PIN="123456"
python backend/create_admin.py
```

That script now writes `security_pin_hash` onto the admin document when `ADMIN_SECURITY_PIN` is present.

## Behavior

- Admin login still uses email/password first.
- Admin APIs stay locked until the PIN is verified.
- The dashboard relocks on tab switch, window blur, or idle timeout.
- A locked first load renders the admin shell without sensitive dashboard data.
