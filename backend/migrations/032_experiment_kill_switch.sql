-- 032: experiments 테이블에 kill_switch 컬럼 추가
-- kill_switch = 1이면 모든 유저를 control로 배정 (긴급 차단)

ALTER TABLE experiments ADD COLUMN kill_switch INTEGER NOT NULL DEFAULT 0;
