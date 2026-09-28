-- The drag-and-drop editor is gone; its templates are code designs now.
-- One never saved from that editor has no markup and has always sent with
-- the Default design, so it becomes an options design with the defaults
-- (any intro, footer note, and buttons in its settings are kept).
UPDATE `templates` SET `mode` = 'design' WHERE `mode` = 'code' AND (`compiled_mjml` IS NULL OR trim(`compiled_mjml`) = '');--> statement-breakpoint
ALTER TABLE `templates` DROP COLUMN `design_json`;--> statement-breakpoint
ALTER TABLE `templates` DROP COLUMN `compiled_html`;
