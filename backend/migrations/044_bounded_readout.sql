-- Prospective only. Apply after 041/043; existing experiments are not enrolled.
ALTER TABLE experiments ADD COLUMN conversion_window_seconds INTEGER
    CHECK (conversion_window_seconds IS NULL OR
           (typeof(conversion_window_seconds) = 'integer' AND conversion_window_seconds BETWEEN 1 AND 2592000));
ALTER TABLE experiments ADD COLUMN one_time_intervention INTEGER NOT NULL DEFAULT 0
    CHECK (one_time_intervention IN (0,1));

CREATE TABLE experiment_readout_contract (
    experiment_id TEXT PRIMARY KEY REFERENCES experiments(id) ON DELETE CASCADE,
    version TEXT NOT NULL DEFAULT 'bounded_v1' CHECK (version = 'bounded_v1'),
    ingestion_grace_seconds INTEGER NOT NULL DEFAULT 86400 CHECK (ingestion_grace_seconds = 86400),
    locked_json TEXT CHECK (locked_json IS NULL OR json_valid(locked_json))
);
CREATE TABLE experiment_readout_snapshot (
    experiment_id TEXT PRIMARY KEY REFERENCES experiments(id) ON DELETE CASCADE,
    contract_json TEXT NOT NULL CHECK (json_valid(contract_json)),
    terminal_history_id INTEGER NOT NULL,
    end_at TEXT NOT NULL,
    finalizes_at TEXT NOT NULL,
    frozen_at TEXT NOT NULL,
    input_sealed INTEGER NOT NULL DEFAULT 0 CHECK (input_sealed IN (0,1)),
    result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json))
);
-- Source ids are copied values, never foreign keys to mutable raw events.
CREATE TABLE experiment_readout_input (
    experiment_id TEXT NOT NULL REFERENCES experiment_readout_snapshot(experiment_id) ON DELETE CASCADE,
    id INTEGER NOT NULL,
    project_id TEXT,
    user_id TEXT NOT NULL,
    variant TEXT,
    event_name TEXT NOT NULL,
    event_time TEXT NOT NULL,
    session_id TEXT,
    created_at TEXT NOT NULL,
    properties TEXT NOT NULL CHECK (json_valid(properties)),
    PRIMARY KEY (experiment_id, id)
);
CREATE TRIGGER validate_readout_snapshot_insert BEFORE INSERT ON experiment_readout_snapshot
WHEN NEW.input_sealed <> 0 OR NEW.result_json IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Readout snapshot must start unsealed'); END;
CREATE TRIGGER freeze_readout_input AFTER INSERT ON experiment_readout_snapshot
BEGIN
    INSERT INTO experiment_readout_input
        (experiment_id,id,project_id,user_id,variant,event_name,event_time,session_id,created_at,properties)
    SELECT e.experiment_id,e.id,e.project_id,e.user_id,e.variant,e.event_name,e.event_time,e.session_id,e.created_at,
        json_object('sdk_event_type',json_extract(e.properties,'$.sdk_event_type'),
            'impression_id',json_extract(e.properties,'$.impression_id'),
            'assignment_id',json_extract(e.properties,'$.assignment_id'),
            'url',json_extract(e.properties,'$.url'),
            'sdk_bounded_eligible',json_extract(e.properties,'$.sdk_bounded_eligible'),
            'sdk_active_period_eligible',json_extract(e.properties,'$.sdk_active_period_eligible'),
            'sdk_exposure_eligible',json_extract(e.properties,'$.sdk_exposure_eligible'),
            'event_model',json_extract(e.properties,'$.event_model'))
    FROM event_log e WHERE e.experiment_id=NEW.experiment_id
        AND e.project_id IS json_extract(NEW.contract_json,'$.project_id')
        AND json_extract(e.properties,'$.event_model')='sdk_v1'
        AND json_extract(e.properties,'$.sdk_bounded_eligible')=1
        AND e.created_at <= NEW.finalizes_at;
    UPDATE experiment_readout_snapshot SET input_sealed=1 WHERE experiment_id=NEW.experiment_id;
END;
CREATE TRIGGER protect_readout_input_insert BEFORE INSERT ON experiment_readout_input
WHEN NOT EXISTS (SELECT 1 FROM experiment_readout_snapshot
                 WHERE experiment_id=NEW.experiment_id AND input_sealed=0)
BEGIN SELECT RAISE(ABORT, 'Readout input is sealed'); END;
CREATE TRIGGER immutable_readout_input BEFORE UPDATE ON experiment_readout_input
BEGIN SELECT RAISE(ABORT, 'Readout input is immutable'); END;
CREATE TRIGGER protect_readout_input_delete BEFORE DELETE ON experiment_readout_input
WHEN EXISTS (SELECT 1 FROM experiment_readout_snapshot WHERE experiment_id=OLD.experiment_id)
BEGIN SELECT RAISE(ABORT, 'Readout input is immutable'); END;
CREATE TRIGGER enroll_bounded_readout AFTER INSERT ON experiments
WHEN NEW.event_model = 'sdk_v1' AND NEW.experiment_type = 'ab_test'
BEGIN
    INSERT OR IGNORE INTO experiment_readout_contract (experiment_id) VALUES (NEW.id);
END;
CREATE TRIGGER validate_readout_create BEFORE INSERT ON experiments
WHEN NEW.conversion_window_seconds IS NOT NULL AND
     (NEW.one_time_intervention <> 1 OR NEW.event_model <> 'sdk_v1' OR NEW.experiment_type <> 'ab_test')
BEGIN SELECT RAISE(ABORT, 'Invalid conversion window'); END;
CREATE TRIGGER validate_readout_update BEFORE UPDATE ON experiments
WHEN NEW.conversion_window_seconds IS NOT NULL AND
     (NEW.one_time_intervention <> 1 OR NOT EXISTS (
         SELECT 1 FROM experiment_readout_contract WHERE experiment_id = OLD.id))
BEGIN SELECT RAISE(ABORT, 'Invalid conversion window'); END;

-- 041 inserts this row in the same statement as the lifecycle transition.
CREATE TRIGGER lock_bounded_readout AFTER INSERT ON experiment_status_history
WHEN NEW.to_status = 'running'
BEGIN
    -- Direct INSERT(status=running) must not depend on AFTER-trigger order.
    -- Only a new creation history row may enroll here; old resumes never enroll.
    INSERT OR IGNORE INTO experiment_readout_contract (experiment_id)
        SELECT e.id FROM experiments e WHERE e.id=NEW.experiment_id
          AND NEW.from_status IS NULL AND e.event_model='sdk_v1' AND e.experiment_type='ab_test';
    UPDATE experiment_readout_contract SET locked_json = (
        SELECT json_object('version', 'bounded_v1', 'conversion_window_seconds', e.conversion_window_seconds,
            'one_time_intervention', e.one_time_intervention, 'ingestion_grace_seconds', 86400,
            'primary_metric', e.primary_metric, 'completion_event', e.completion_event,
            'guardrail_metrics', json(COALESCE(e.guardrail_metrics, '[]')),
            'project_id', e.project_id, 'flag_key', e.flag_key, 'experiment_type', e.experiment_type,
            'event_model', e.event_model, 'attribution_version', 'first_exposure_v1',
            'statistics_version', 'beta_mc_pcg64_v1', 'srm_expected', 'equal',
            'variant_names', json(COALESCE((SELECT json_group_array(variant) FROM
                (SELECT 'control' AS variant UNION SELECT 'treatment' UNION SELECT variant FROM feature_flag_rule
                 WHERE flag_key = e.flag_key AND enabled = 1)), '[]')))
        FROM experiments e WHERE e.id = NEW.experiment_id
    ) WHERE experiment_id = NEW.experiment_id AND locked_json IS NULL;
END;
CREATE TRIGGER immutable_readout_contract BEFORE UPDATE ON experiment_readout_contract
WHEN OLD.locked_json IS NOT NULL OR NEW.experiment_id IS NOT OLD.experiment_id
     OR NEW.version IS NOT OLD.version OR NEW.ingestion_grace_seconds IS NOT OLD.ingestion_grace_seconds
BEGIN SELECT RAISE(ABORT, 'Measurement contract is locked'); END;
CREATE TRIGGER protect_measurement_fields BEFORE UPDATE ON experiments
WHEN EXISTS (SELECT 1 FROM experiment_readout_contract WHERE experiment_id = OLD.id AND locked_json IS NOT NULL)
 AND (NEW.conversion_window_seconds IS NOT OLD.conversion_window_seconds
      OR NEW.one_time_intervention IS NOT OLD.one_time_intervention
      OR NEW.primary_metric IS NOT OLD.primary_metric OR NEW.completion_event IS NOT OLD.completion_event
      OR NEW.guardrail_metrics IS NOT OLD.guardrail_metrics OR NEW.project_id IS NOT OLD.project_id
      OR NEW.flag_key IS NOT OLD.flag_key OR NEW.event_model IS NOT OLD.event_model
      OR NEW.experiment_type IS NOT OLD.experiment_type OR NEW.variant_names_json IS NOT OLD.variant_names_json)
BEGIN SELECT RAISE(ABORT, 'Measurement contract is locked'); END;
CREATE TRIGGER protect_bounded_lifecycle BEFORE UPDATE OF status ON experiments
WHEN EXISTS (SELECT 1 FROM experiment_readout_contract WHERE experiment_id = OLD.id)
 AND NEW.status <> OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status IN ('running','archived')) OR
    (OLD.status = 'running' AND NEW.status IN ('paused','completed','archived')) OR
    (OLD.status = 'paused' AND NEW.status IN ('running','completed','archived')))
BEGIN SELECT RAISE(ABORT, 'Invalid experiment transition'); END;
CREATE TRIGGER immutable_readout_snapshot BEFORE UPDATE ON experiment_readout_snapshot
WHEN NOT (
    (OLD.input_sealed=0 AND NEW.input_sealed=1 AND OLD.result_json IS NULL AND NEW.result_json IS NULL)
    OR (OLD.input_sealed=1 AND NEW.input_sealed=1 AND OLD.result_json IS NULL AND NEW.result_json IS NOT NULL))
 OR NEW.experiment_id IS NOT OLD.experiment_id OR NEW.contract_json IS NOT OLD.contract_json
 OR NEW.terminal_history_id IS NOT OLD.terminal_history_id OR NEW.end_at IS NOT OLD.end_at
 OR NEW.finalizes_at IS NOT OLD.finalizes_at OR NEW.frozen_at IS NOT OLD.frozen_at
BEGIN SELECT RAISE(ABORT, 'Readout snapshot is immutable'); END;
