import { useEffect } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { StudyListPage } from './pages/StudyListPage'
import { ExperimentShowcase } from './components/ExperimentShowcase'
import { ExperimentProvider } from './lib/ExperimentContext'
import { initVisualEditor } from './lib/visualEditor'
import type { Lang } from './i18n'

const FLAG_KEYS = ['home_layout_v1', 'sponsor_slot_v1'] as const

type Props = {
  lang: Lang
}

export function ExampleApp({ lang }: Props) {
  useEffect(() => {
    initVisualEditor()
  }, [])

  return (
    <ExperimentProvider apiKey="pk_live_demo_7g8h9i0j1k2l" flagKeys={FLAG_KEYS} projectId="demo-app">
      <Layout lang={lang}>
        <Routes>
          <Route index element={<HomePage lang={lang} />} />
          <Route path="studies" element={<StudyListPage lang={lang} />} />
          <Route path="experiments" element={<ExperimentShowcase lang={lang} />} />
          <Route path="*" element={<Navigate to="/example" replace />} />
        </Routes>
      </Layout>
    </ExperimentProvider>
  )
}
