// Flag → Experiment 이름 매핑.
// 데모 앱이 decide() 호출 후 동일 사용자를 해당 실험에도 배정시키기 위한 바인딩.
//
// 주의: 백엔드는 Flag와 Experiment를 자동 연결하지 않습니다.
// - decide:  CRC32(user_id:flag_key:rule_id) % 100   → feature_flag_exposure 적재
// - assign: SHA256(experiment_id:user_id)            → experiment_assignments 적재
// 알고리즘이 다르므로 같은 사용자라도 두 결과가 일치하지 않을 수 있습니다.
// 데모에서는 UI는 decide 결과로 렌더링하고, 통계용 데이터는 assign으로 별도 적재합니다.

export const FLAG_TO_EXPERIMENT: Record<string, string> = {
  home_layout_v1: 'home_layout_exp_v1',
  sponsor_slot_v1: 'sponsor_slot_exp_v1',
}
