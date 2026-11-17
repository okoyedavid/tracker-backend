-- Public signup remains separate from supervisor account provisioning.
UPDATE receipt_tracker.roles
SET permissions = array_append(permissions, 'user:create'), updated_at = now()
WHERE key = 'supervisor' AND type = 'system'
  AND NOT ('user:create' = ANY(permissions));
