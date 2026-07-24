import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { BeachPage } from './pages/BeachPage';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/beaches/:slug" element={<BeachPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
