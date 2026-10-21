-- Applied by the table owner after the schema migration.
-- app_user is NOSUPERUSER NOBYPASSRLS, so these policies are enforced.

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

REVOKE UPDATE, DELETE ON form_versions FROM app_user;
REVOKE UPDATE, DELETE ON submission_revisions FROM app_user;
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
REVOKE UPDATE, DELETE ON correction_request_fields FROM app_user;
REVOKE UPDATE, DELETE ON email_delivery_events FROM app_user;

CREATE OR REPLACE FUNCTION app_tenant_match(organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.bypass_rls', true) = 'on'
    OR organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'vendors',
    'vendor_categories',
    'vendor_category_links',
    'vendor_exhibitions',
    'exhibitions',
    'form_templates',
    'form_versions',
    'form_assignments',
    'invitations',
    'submissions',
    'submission_revisions',
    'correction_requests',
    'correction_request_fields',
    'review_notes',
    'documents',
    'document_versions',
    'notifications',
    'email_messages',
    'email_delivery_events',
    'outbox_events',
    'audit_logs',
    'import_jobs',
    'import_job_rows'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (app_tenant_match(organization_id)) WITH CHECK (app_tenant_match(organization_id))',
      table_name
    );
  END LOOP;
END $$;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON sessions;
CREATE POLICY tenant_isolation ON sessions
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = sessions.user_id
        AND app_tenant_match(users.organization_id)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = sessions.user_id
        AND app_tenant_match(users.organization_id)
    )
  );

ALTER TABLE mfa_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_secrets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON mfa_secrets;
CREATE POLICY tenant_isolation ON mfa_secrets
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (SELECT 1 FROM users WHERE users.id = mfa_secrets.user_id AND app_tenant_match(users.organization_id))
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (SELECT 1 FROM users WHERE users.id = mfa_secrets.user_id AND app_tenant_match(users.organization_id))
  );

ALTER TABLE mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_challenges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON mfa_challenges;
CREATE POLICY tenant_isolation ON mfa_challenges
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (SELECT 1 FROM users WHERE users.id = mfa_challenges.user_id AND app_tenant_match(users.organization_id))
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (SELECT 1 FROM users WHERE users.id = mfa_challenges.user_id AND app_tenant_match(users.organization_id))
  );

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON user_roles;
CREATE POLICY tenant_isolation ON user_roles
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (SELECT 1 FROM users WHERE users.id = user_roles.user_id AND app_tenant_match(users.organization_id))
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (SELECT 1 FROM users WHERE users.id = user_roles.user_id AND app_tenant_match(users.organization_id))
  );

CREATE OR REPLACE FUNCTION reject_row_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is immutable', TG_TABLE_NAME;
END $$;

DROP TRIGGER IF EXISTS form_versions_immutable ON form_versions;
CREATE TRIGGER form_versions_immutable BEFORE UPDATE OR DELETE ON form_versions
FOR EACH ROW EXECUTE FUNCTION reject_row_change();

DROP TRIGGER IF EXISTS submission_revisions_immutable ON submission_revisions;
CREATE TRIGGER submission_revisions_immutable BEFORE UPDATE OR DELETE ON submission_revisions
FOR EACH ROW EXECUTE FUNCTION reject_row_change();

DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_row_change();

CREATE OR REPLACE FUNCTION users_same_org_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE other_org uuid;
BEGIN
  IF NEW.vendor_id IS NOT NULL THEN
    SELECT organization_id INTO other_org FROM vendors WHERE id = NEW.vendor_id;
    IF other_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'cross-tenant vendor reference';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION form_templates_same_org_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE other_org uuid;
BEGIN
  IF NEW.exhibition_id IS NOT NULL THEN
    SELECT organization_id INTO other_org FROM exhibitions WHERE id = NEW.exhibition_id;
    IF other_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'cross-tenant exhibition reference';
    END IF;
  END IF;
  IF NEW.vendor_id IS NOT NULL THEN
    SELECT organization_id INTO other_org FROM vendors WHERE id = NEW.vendor_id;
    IF other_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'cross-tenant vendor reference';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION documents_same_org_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE other_org uuid;
BEGIN
  IF NEW.exhibition_id IS NOT NULL THEN
    SELECT organization_id INTO other_org FROM exhibitions WHERE id = NEW.exhibition_id;
    IF other_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'cross-tenant exhibition reference';
    END IF;
  END IF;
  IF NEW.assignment_id IS NOT NULL THEN
    SELECT organization_id INTO other_org FROM form_assignments WHERE id = NEW.assignment_id;
    IF other_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'cross-tenant assignment reference';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION invitations_same_org_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE other_org uuid;
BEGIN
  IF NEW.assignment_id IS NOT NULL THEN
    SELECT organization_id INTO other_org FROM form_assignments WHERE id = NEW.assignment_id;
    IF other_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'cross-tenant assignment reference';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS users_same_org ON users;
CREATE TRIGGER users_same_org BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION users_same_org_fn();
DROP TRIGGER IF EXISTS form_templates_same_org ON form_templates;
CREATE TRIGGER form_templates_same_org BEFORE INSERT OR UPDATE ON form_templates
FOR EACH ROW EXECUTE FUNCTION form_templates_same_org_fn();
DROP TRIGGER IF EXISTS documents_same_org ON documents;
CREATE TRIGGER documents_same_org BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION documents_same_org_fn();
DROP TRIGGER IF EXISTS invitations_same_org ON invitations;
CREATE TRIGGER invitations_same_org BEFORE INSERT OR UPDATE ON invitations
FOR EACH ROW EXECUTE FUNCTION invitations_same_org_fn();
