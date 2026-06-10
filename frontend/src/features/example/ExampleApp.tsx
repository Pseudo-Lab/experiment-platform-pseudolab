import { useEffect } from 'react'
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

  return (
    <ExperibaseProvider
      apiKey="pk_live_demo_7g8h9i0j1k2l"
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
