import { useExperimentContext } from '../lib/ExperimentContext'

export function useFeatureFlag(flagKey: string): { variant: string; isLoading: boolean } {
  const { variants, isLoading } = useExperimentContext()
  const variant = variants[flagKey]
  return {
    variant: variant ?? 'control',
    isLoading: isLoading && variant === undefined,
  }
}
