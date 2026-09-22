# Login password visibility

All staff roles can use **Show** / **Hide** on the login password field. Passwords
are hidden initially and hidden again when the login form is submitted. The
button only changes the field's display; it does not change the password, submit
the form, or store the visibility preference. Existing authentication is unchanged.

Use Show only when other people cannot see the screen.

## Manual checks

Use a made-up password, not a real staff credential, for these checks:

1. Open Staff sign in. Confirm the password is masked initially.
2. Enter a test email and password. Select Show: the same password becomes visible
   and the button changes to Hide. The form must not submit.
3. Select Hide: the password becomes masked without losing any characters.
4. Tab to the visibility button and activate it with Enter and Space. Confirm
   that the focus indicator is visible and each activation switches visibility.
5. Check the layout on desktop and a narrow mobile screen. Text must not overlap
   the button, and the form must not scroll sideways.
6. In an isolated test environment, submit the form while the password is shown.
   Confirm it becomes masked and the normal login success/error behavior remains.
