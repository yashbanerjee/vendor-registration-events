CREATE OR REPLACE FUNCTION app_tenant_match(organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.bypass_rls', true) = 'on'
    OR organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid
$$;

ALTER TABLE client_error_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_error_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON client_error_events;
CREATE POLICY tenant_isolation ON client_error_events
  USING (app_tenant_match(organization_id))
  WITH CHECK (app_tenant_match(organization_id));
