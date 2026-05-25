import { Navigate, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { StudyListPage } from './pages/StudyListPage'
import type { Lang } from './i18n'

type Props = {
  lang: Lang
}

export function ExampleApp({ lang }: Props) {
  return (
    <Layout lang={lang}>
      <Routes>
        <Route index element={<HomePage lang={lang} />} />
        <Route path="studies" element={<StudyListPage lang={lang} />} />
        <Route path="*" element={<Navigate to="/example" replace />} />
      </Routes>
    </Layout>
  )
}
