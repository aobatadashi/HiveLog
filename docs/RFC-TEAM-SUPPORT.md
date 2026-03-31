# RFC: Team / Organization Support for HiveLog

**Status:** Draft
**Author:** HiveLog team
**Date:** 2026-03-30

---

## 1. Problem

HiveLog's Row Level Security (RLS) scopes all data — yards, colonies, and events — to `auth.uid()`. Every row belongs to exactly one user. This creates two bad options for commercial operations with multiple employees:

1. **Shared account.** Everyone uses the same phone number and PIN. This works for data access but destroys the audit trail: every event's `logged_by` field points to the same user, making it impossible to know who actually performed an inspection or treatment.

2. **Separate accounts.** Each employee creates their own account. Data is completely siloed — a manager cannot see a worker's logged events, and there is no unified view of the operation. Workers who leave take their data with them (or it becomes orphaned).

Neither approach works for operations running above roughly 1,500 hives, where multiple employees inspect different yards on the same day and a manager needs a consolidated view for compliance reporting. The current model forces a choice between accountability and visibility.

---

## 2. Proposed Data Model

### 2.1 New tables

#### `organizations`

| Column       | Type         | Constraints                                      |
|-------------|-------------|--------------------------------------------------|
| `id`        | UUID        | PK, `DEFAULT gen_random_uuid()`                  |
| `name`      | TEXT        | NOT NULL                                          |
| `created_at`| TIMESTAMPTZ | NOT NULL, `DEFAULT now()`                         |
| `owner_id`  | UUID        | NOT NULL, REFERENCES `auth.users(id)` ON DELETE CASCADE |

The `owner_id` is the user who created the organization. This user has full administrative control and cannot be removed from the org without transferring ownership first.

#### `org_members`

| Column      | Type         | Constraints                                      |
|------------|-------------|--------------------------------------------------|
| `org_id`   | UUID        | NOT NULL, REFERENCES `organizations(id)` ON DELETE CASCADE |
| `user_id`  | UUID        | NOT NULL, REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `role`     | TEXT        | NOT NULL, CHECK (`role` IN ('owner', 'manager', 'worker')) |
| `joined_at`| TIMESTAMPTZ | NOT NULL, `DEFAULT now()`                         |

Composite primary key: `(org_id, user_id)`.

**Roles (v1 — all three have identical read/write permissions):**

- `owner` — Can manage org settings, invite/remove members, delete the org.
- `manager` — Can invite/remove workers. Cannot delete the org or remove the owner.
- `worker` — Can log events and view data. Cannot manage members.

Role-based *data* permissions (e.g., restricting workers to assigned yards) are explicitly out of scope. All members see all org data.

### 2.2 Schema changes to existing tables

#### `yards` — add `org_id`

```sql
ALTER TABLE yards ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_yards_org_id ON yards(org_id);
```

The column is nullable for backwards compatibility. Solo users (not in any org) continue to use `owner_id`-scoped access. When `org_id` is set, RLS uses org membership instead.

### 2.3 Updated RLS policies

The core RLS change: if a yard has `org_id`, any member of that org can see the yard, its colonies, and their events. If `org_id` is NULL, the existing `owner_id` check applies.

**Yards (SELECT example):**

```sql
CREATE POLICY "Users can view yards in their org or their own"
  ON yards FOR SELECT
  USING (
    auth.uid() = owner_id
    OR (
      org_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM org_members
        WHERE org_members.org_id = yards.org_id
          AND org_members.user_id = auth.uid()
      )
    )
  );
```

The same pattern applies to INSERT, UPDATE, and DELETE on yards, and cascades through the existing colony/event RLS policies (which already join through yards).

**Events — `logged_by` becomes critical:**

With team access, multiple users log events against shared colonies. The `logged_by` UUID on every event becomes the primary accountability mechanism. The existing `logged_by` field requires no schema change — it already stores the acting user's UUID. The UI change to display `logged_by` (currently showing truncated UUIDs) should be upgraded to show display names via a `profiles` table before team support ships.

### 2.4 `profiles` table (prerequisite)

```sql
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can read profiles"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

Auto-populate via trigger on `auth.users` insert:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.phone, NEW.email, NEW.id::text));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## 3. Migration Path

### Phase 1: Schema additions (no user-facing changes)

1. Create `organizations`, `org_members`, and `profiles` tables with RLS.
2. Add `org_id` column to `yards` (nullable, no existing rows affected).
3. Add the `handle_new_user` trigger. Backfill `profiles` for existing users:
   ```sql
   INSERT INTO profiles (id, display_name)
   SELECT id, COALESCE(phone, email, id::text)
   FROM auth.users
   ON CONFLICT (id) DO NOTHING;
   ```
4. Update the `logged_by` display in the UI to resolve UUIDs via the `profiles` table (replacing the current truncated-UUID fallback).

Solo users are completely unaffected. No RLS changes yet.

### Phase 2: Organization creation and membership UI

1. Add "Create Organization" flow in Settings:
   - User enters org name.
   - Creates the `organizations` row with `owner_id = auth.uid()`.
   - Creates an `org_members` row with `role = 'owner'`.
2. Add "Invite Member" flow:
   - Owner/manager enters a phone number.
   - If the phone matches an existing user, add them to `org_members` with `role = 'worker'`.
   - If no match, show a message: "This phone number hasn't signed up yet. They'll need to create an account first."
   - No invite links, no email invitations — keep it simple for v1.
3. Add member list view in Settings with role display and remove capability.
4. Add "Assign Yards to Org" flow: existing solo yards can be moved into the org by setting `org_id`.

### Phase 3: RLS policy updates

1. Replace the four yard RLS policies with org-aware versions (as shown in section 2.3).
2. Update colony and event RLS policies — these already join through yards, so the yard-level change cascades automatically.
3. Test thoroughly:
   - Solo user (no org) can still CRUD their own data.
   - Org member can see all org yards/colonies/events.
   - Org member cannot see another org's data.
   - Org member cannot see a solo user's non-org data.
   - `logged_by` correctly attributes events to the acting user.

---

## 4. Scope Boundaries

This RFC does **not** cover:

- **Role-based data permissions.** All org members see all org data. No yard-level assignment or data hiding.
- **Org-level settings.** No org-wide preferences, branding, or configuration.
- **Billing or subscriptions.** No payment tiers, seat-based pricing, or usage limits.
- **Cross-org data sharing.** No mechanism for two orgs to share yards or events.
- **Audit log table.** The `logged_by` field on events provides attribution. A separate audit log for admin actions (member added/removed, org settings changed) is a future enhancement.
- **Org discovery or directory.** Users cannot search for or browse existing orgs. Membership is by direct invitation only.

---

## 5. Open Questions

### 5.1 Can a user belong to multiple organizations?

The `org_members` composite PK `(org_id, user_id)` allows this. But the UI implications are significant: which org's data does the user see after login? Options:

- **Org switcher** in the header/settings — adds complexity but is necessary for consultants or multi-operation workers.
- **Single org only** — simpler but blocks legitimate use cases (seasonal workers helping multiple operations).

**Recommendation:** Allow multiple memberships at the data layer (it's free). Defer the org-switcher UI to a fast-follow. For v1, if a user is in multiple orgs, show all org data merged (with org name labels on yards).

### 5.2 Should workers see all yards or only assigned ones?

Some operations have 50+ yards spread across a region. Showing all of them to every worker adds noise. But yard-level assignment adds a permission layer that complicates RLS and the invitation flow.

**Recommendation:** Show all org yards to all members in v1. If field feedback shows this is a problem, add optional yard-level assignment in a follow-up (add `yard_assignments` junction table, update RLS with an additional check).

### 5.3 How do we handle a user leaving an org?

When a member is removed from `org_members`, their historical events still reference their `user_id` in `logged_by`. Options:

- **Keep the UUID reference.** Events retain attribution. The user's profile row still exists (they still have a HiveLog account). Their display name resolves correctly.
- **Reassign events to a sentinel.** Loses attribution. Bad for compliance.
- **Soft-delete the membership.** Add a `left_at` timestamp instead of deleting the row. Preserves the relationship for audit queries but complicates active-member queries.

**Recommendation:** Hard-delete the `org_members` row. Keep `logged_by` as-is. The `profiles` table ensures the display name still resolves. If the user deletes their entire HiveLog account, `ON DELETE CASCADE` removes their profile — events would show a raw UUID. This is acceptable for v1 since account deletion is rare.

### 5.4 What happens when an org is deleted?

Options:

- **Cascade delete everything.** All org yards, colonies, and events are permanently destroyed. Simple but destructive.
- **Orphan the yards.** Set `org_id = NULL`, revert yards to the original `owner_id`. But which user becomes the owner? The org owner? That could dump thousands of yards onto one account.
- **Block deletion.** Require the org to have zero yards before deletion (force the owner to delete or transfer yards first).

**Recommendation:** Block deletion if the org has any yards. The owner must delete or reassign all yards first. This prevents accidental data loss and forces a deliberate cleanup process.
