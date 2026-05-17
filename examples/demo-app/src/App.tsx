import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { StudyListPage } from './pages/StudyListPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/studies" element={<StudyListPage />} />
      </Routes>
    </Layout>
  )
}
