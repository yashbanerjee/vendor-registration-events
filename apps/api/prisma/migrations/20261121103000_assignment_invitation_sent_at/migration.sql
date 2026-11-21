-- Track whether the vendor invitation email was already sent (one-time send from Companies list).
ALTER TABLE "form_assignments" ADD COLUMN "invitation_sent_at" TIMESTAMPTZ(6);

-- Existing assignments that already have an invitation count as sent.
UPDATE "form_assignments" AS fa
SET "invitation_sent_at" = sub.first_invite
FROM (
  SELECT "assignment_id", MIN("created_at") AS first_invite
  FROM "invitations"
  WHERE "assignment_id" IS NOT NULL
  GROUP BY "assignment_id"
) AS sub
WHERE fa."id" = sub."assignment_id"
  AND fa."invitation_sent_at" IS NULL;
