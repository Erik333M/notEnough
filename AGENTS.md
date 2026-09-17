# Expo HAS CHANGED

## Architecture invariants
- ONE account type. No `user.type` / `user.role` column.
- Roles are team-scoped via `memberships(user_id, team_id, role)`.
- Solo users = zero memberships. Same tables, `team_id` null.
  Never fork into separate solo vs team code paths.
- All permission checks go through lib/auth/permissions.ts.
  No ad-hoc `if (isCoach)` in components or endpoints.

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
