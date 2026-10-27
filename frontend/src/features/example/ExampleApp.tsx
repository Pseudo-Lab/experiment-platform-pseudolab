import { useEffect, useState } from 'react'
import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { StudyListPage } from './pages/StudyListPage'
import { ExperimentShowcase } from './components/ExperimentShowcase'
import { ExperibaseProvider } from '@pseudo-lab/experibase-sdk/react'
import { ExperimentContextBridge } from './lib/ExperimentContext'
import { initVisualEditor } from './lib/visualEditor'
import { getUserId } from './lib/userId'
import { API_BASE_URL } from './lib/apiBase'
import type { Lang } from './i18n'

const FLAG_KEYS = ['home_layout_v1', 'sponsor_slot_v1'] as const

type Props = {
  lang: Lang
}

function ExampleRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/example${search}`} replace />
}

export function ExampleApp({ lang }: Props) {
  useEffect(() => {
    initVisualEditor()
  }, [])

  const [apiKey, setApiKey] = useState<string>()
  const [configError, setConfigError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/sdk/demo-config`, {
          cache: 'no-store', signal: controller.signal,
        })
        if (!response.ok) throw new Error('Demo configuration unavailable')
        const data = await response.json()
        if (typeof data.api_key !== 'string' || !data.api_key) throw new Error('Invalid demo configuration')
        if (!controller.signal.aborted) {
          setApiKey(data.api_key)
          setConfigError(false)
        }
      } catch {
        if (!controller.signal.aborted) {
          setApiKey(undefined)
          setConfigError(true)
        }
      }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 30_000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [])

  if (configError) return <div role="alert">{lang === 'ko' ? '예제 설정을 불러오지 못했습니다. 잠시 후 다시 시도합니다.' : 'Unable to load demo settings. Retrying shortly.'}</div>
  if (!apiKey) return <div role="status">{lang === 'ko' ? '예제 설정을 불러오는 중입니다.' : 'Loading demo settings.'}</div>

  return (
    <ExperibaseProvider
      key={apiKey}
      apiKey={apiKey}
      baseUrl={API_BASE_URL}
      userId={getUserId()}
      flagKeys={FLAG_KEYS}
    >
      <ExperimentContextBridge>
        <Layout lang={lang}>
          <Routes>
            <Route index element={<HomePage lang={lang} />} />
            <Route path="studies" element={<StudyListPage lang={lang} />} />
            <Route path="experiments" element={<ExperimentShowcase lang={lang} />} />
            <Route path="*" element={<ExampleRedirect />} />
          </Routes>
        </Layout>
      </ExperimentContextBridge>
    </ExperibaseProvider>
  )
}
