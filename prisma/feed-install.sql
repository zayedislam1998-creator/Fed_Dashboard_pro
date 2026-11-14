BEGIN;

CREATE TABLE IF NOT EXISTS workspace_feed_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  owner_user_id TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lifecycle TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (lifecycle IN ('ACTIVE', 'DRAFT', 'PAST')),
  due_date TEXT,
  removed_at TIMESTAMPTZ(6),
  UNIQUE (source_type, source_id)
);
CREATE INDEX IF NOT EXISTS workspace_feed_items_created_at_id_idx ON workspace_feed_items (created_at, id);
CREATE TABLE IF NOT EXISTS workspace_feed_progress (
  item_id TEXT NOT NULL REFERENCES workspace_feed_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ(6),
  status TEXT NOT NULL DEFAULT 'PENDING',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  reason TEXT,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, user_id)
);

CREATE OR REPLACE FUNCTION workspace_capture_feed_item() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  source JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE workspace_feed_items SET removed_at = CURRENT_TIMESTAMP, lifecycle = 'PAST'
    WHERE source_type = TG_ARGV[0] AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  source := to_jsonb(NEW);
  IF TG_OP = 'INSERT' THEN
    INSERT INTO workspace_feed_items (source_type, source_id, title, owner_user_id, due_date, lifecycle, created_at)
    VALUES (TG_ARGV[0], NEW.id, COALESCE(NULLIF(source->>TG_ARGV[1], ''), NEW.id),
      COALESCE(source->>'owner_user_id', source->>'user_id'), NULLIF(source->>TG_ARGV[2], ''),
      CASE WHEN TG_ARGV[0] = 'posts' AND source->>'status' <> 'PUBLISHED' THEN 'DRAFT' ELSE 'ACTIVE' END, clock_timestamp())
    ON CONFLICT (source_type, source_id) DO NOTHING;
  ELSE
    UPDATE workspace_feed_items
    SET title = COALESCE(NULLIF(source->>TG_ARGV[1], ''), NEW.id),
        owner_user_id = COALESCE(source->>'owner_user_id', source->>'user_id'),
        due_date = NULLIF(source->>TG_ARGV[2], ''),
        removed_at = CASE WHEN source->>'deleted_at' IS NOT NULL THEN COALESCE(removed_at, CURRENT_TIMESTAMP) ELSE NULL END,
        lifecycle = CASE
          WHEN source->>'deleted_at' IS NOT NULL THEN 'PAST'
          WHEN TG_ARGV[0] = 'posts' AND source->>'status' IS DISTINCT FROM to_jsonb(OLD)->>'status'
            THEN CASE WHEN source->>'status' = 'PUBLISHED' THEN 'ACTIVE' ELSE 'DRAFT' END
          ELSE lifecycle END
    WHERE source_type = TG_ARGV[0] AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_feed_capture ON cmh_tasks;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON cmh_tasks
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('cmh_tasks', 'title', 'due_date');

DROP TRIGGER IF EXISTS workspace_feed_capture ON cmh_projects;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON cmh_projects
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('cmh_projects', 'title', 'deadline');

DROP TRIGGER IF EXISTS workspace_feed_capture ON cmh_form_templates;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON cmh_form_templates
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('cmh_forms', 'title', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_docs;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_docs
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('docs', 'title', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_slides;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_slides
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('slides', 'title', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_forms;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_forms
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('forms', 'title', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_posts_notices;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_posts_notices
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('posts', 'title', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_files;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_files
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('files', 'name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_folders;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_folders
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('folders', 'name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_meetings;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_meetings
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('meet', 'title', 'scheduled_for');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_calendar_events;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_calendar_events
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('calendar', 'title', 'date');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_sheets;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_sheets
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('sheets', 'title', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_invoices;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_invoices
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('invoice', 'invoice_number', 'due_date');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_expenses;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_expenses
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('expense', 'title', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_crm_leads;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_crm_leads
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('lead', 'name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_support_tickets;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_support_tickets
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('ticket', 'subject', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_hr_records;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_hr_records
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('hr', 'member_name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_wiki_articles;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_wiki_articles
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('wiki', 'title', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_automation_rules;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_automation_rules
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('automations', 'name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_team_groups;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_team_groups
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('team_groups', 'name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_members;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_members
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('members', 'full_name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_chat_channels;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_chat_channels
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('chat', 'name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON bulk_campaigns;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON bulk_campaigns
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('bulk', 'name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_resume_profiles;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_resume_profiles
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('resume', 'full_name', '');

DROP TRIGGER IF EXISTS workspace_feed_capture ON workspace_corporate_websites;
CREATE TRIGGER workspace_feed_capture AFTER INSERT OR UPDATE OR DELETE ON workspace_corporate_websites
FOR EACH ROW EXECUTE FUNCTION workspace_capture_feed_item('corporate', 'org_name', '');

CREATE TABLE IF NOT EXISTS workspace_feed_preferences (
  id TEXT PRIMARY KEY,
  default_tab TEXT NOT NULL CHECK (default_tab IN ('', 'ALL', 'ACTIVE', 'DRAFT', 'PAST'))
);

COMMIT;
