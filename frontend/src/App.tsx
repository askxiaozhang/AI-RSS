import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import UrlAnalyzer from './pages/UrlAnalyzer'
import Feeds from './pages/Feeds'
import FeedDetail from './pages/FeedDetail'
import Chat from './pages/Chat'
import FilterView from './pages/FilterView'
import ReaderView from './pages/ReaderView'
import Teams from './pages/Teams'
import TeamDetail from './pages/TeamDetail'
import JoinTeam from './pages/JoinTeam'

function PrivateRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invite/:token" element={<JoinTeam />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="analyze" element={<UrlAnalyzer />} />
        <Route path="feeds" element={<Feeds />} />
        <Route path="feeds/:feedId" element={<FeedDetail />} />
        <Route path="filter" element={<FilterView />} />
        <Route path="reader" element={<ReaderView />} />
        <Route path="chat" element={<Chat />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:teamId" element={<TeamDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
