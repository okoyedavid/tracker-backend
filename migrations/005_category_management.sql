UPDATE receipt_tracker.roles
SET permissions=array_append(permissions,'categories:update'),updated_at=now()
WHERE key='supervisor' AND type='system' AND NOT ('categories:update'=ANY(permissions));
UPDATE receipt_tracker.roles
SET permissions=array_append(permissions,'categories:delete'),updated_at=now()
WHERE key='supervisor' AND type='system' AND NOT ('categories:delete'=ANY(permissions));
