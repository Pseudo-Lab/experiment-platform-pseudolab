-- Prospective policy only: do not reinterpret any existing experiment or event.
-- Apply 041 first. Both policy and initial history are written with experiment creation.
CREATE TABLE IF NOT EXISTS experiment_readout_policy (
    experiment_id TEXT PRIMARY KEY REFERENCES experiments(id) ON DELETE CASCADE,
    version TEXT NOT NULL CHECK (version = 'active_period_v1')
);

CREATE TRIGGER IF NOT EXISTS keep_sdk_readout_policy_version
BEFORE UPDATE ON experiment_readout_policy
BEGIN
    SELECT RAISE(ABORT, 'Experiment readout policy is immutable');
END;

CREATE TRIGGER IF NOT EXISTS assign_sdk_active_period_policy
AFTER INSERT ON experiments
WHEN NEW.event_model = 'sdk_v1' AND NEW.experiment_type = 'ab_test'
BEGIN
    INSERT INTO experiment_readout_policy (experiment_id, version)
        VALUES (NEW.id, 'active_period_v1');
END;
