-- Telemetria do Underpants Hero. Nenhuma coluna guarda IP ou user agent.

CREATE TABLE runs (
  run_id         TEXT    NOT NULL,
  revision       INTEGER NOT NULL,
  kind           TEXT    NOT NULL,              -- 'summary' (uh-run-summary/1) | 'pilot' (payloads antigos, guardados crus)
  payload_schema TEXT    NOT NULL,
  lifecycle      TEXT    NOT NULL DEFAULT 'final', -- 'open' | 'final'
  grant_id       TEXT,
  sha256         TEXT    NOT NULL,              -- sha256 dos bytes JSON descomprimidos (vai no recibo)
  received_at    TEXT    NOT NULL,
  day            TEXT    NOT NULL,              -- YYYY-MM-DD (UTC) do recebimento
  raw            TEXT    NOT NULL,              -- JSON exatamente como recebido
  doc            TEXT,                          -- payload do resumo quando veio dentro de envelope; NULL se raw já é o resumo
  build_version  TEXT,
  build_commit   TEXT,
  build_channel  TEXT,
  character      TEXT,
  difficulty     TEXT,
  mode           TEXT,
  players        INTEGER,
  platform       TEXT,
  locale         TEXT,
  result         TEXT,                          -- victory | death | abandoned
  wave_reached   INTEGER,
  waves_completed INTEGER,
  duration_s     REAL,
  level          INTEGER,
  death_wave     INTEGER,
  killer         TEXT,
  session_id     TEXT,
  run_index      INTEGER,
  PRIMARY KEY (run_id, revision)
);
CREATE INDEX runs_grant_day ON runs (grant_id, day);
CREATE INDEX runs_stats ON runs (kind, lifecycle, difficulty, day);
CREATE INDEX runs_session ON runs (session_id);

CREATE TABLE feedback (
  response_id      TEXT PRIMARY KEY,
  run_id           TEXT NOT NULL,
  grant_id         TEXT,
  revision         INTEGER NOT NULL DEFAULT 1,
  rating           INTEGER NOT NULL,
  comment          TEXT NOT NULL DEFAULT '',
  tags             TEXT NOT NULL DEFAULT '[]',  -- array JSON de strings
  locale           TEXT,
  question_version TEXT,
  scale_version    TEXT,
  sha256           TEXT NOT NULL,
  received_at      TEXT NOT NULL,
  day              TEXT NOT NULL,
  raw              TEXT NOT NULL
);
CREATE INDEX feedback_run ON feedback (run_id);
CREATE INDEX feedback_grant_day ON feedback (grant_id, day);
