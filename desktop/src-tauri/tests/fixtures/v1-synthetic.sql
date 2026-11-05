-- Synthetic Ember schema v1 database, as created by the first desktop foundation build.
-- Used to prove that newer builds open existing v1 files without altering them.
-- Contains no personal history. Do not replace with real data.
CREATE TABLE habits (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL UNIQUE,
            start_date TEXT NOT NULL,
            archived_at TEXT
          );
CREATE TABLE completions (
            habit_id TEXT NOT NULL REFERENCES habits(id),
            date TEXT NOT NULL,
            PRIMARY KEY (habit_id, date)
          );
CREATE INDEX completions_by_date ON completions(date);
INSERT INTO habits (id, name, sort_order, start_date, archived_at) VALUES
  ('fedcba9876543210fedcba9876543210', 'Synthetic walk', 0, '2028-01-01', NULL),
  ('00000000000000000000000000000001', 'Synthetic retired', 1, '2027-12-01', '2028-01-15'),
  ('0123456789abcdef0123456789abcdef', 'Synthetic read', 2, '2028-02-01', NULL);
INSERT INTO completions (habit_id, date) VALUES
  ('00000000000000000000000000000001', '2028-01-10'),
  ('0123456789abcdef0123456789abcdef', '2028-02-28'),
  ('0123456789abcdef0123456789abcdef', '2028-02-29');
PRAGMA user_version = 1;
