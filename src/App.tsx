import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { BeachPage } from './pages/BeachPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

// The map and its coastline code are loaded only when someone opens the map.
const MapPage = lazy(() => import('./pages/MapPage').then((module) => ({ default: module.MapPage })));

function MapLoading() {
  return (
    <section className="map-page">
      <p className="eyebrow">Map</p>
      <h1>Loading the map…</h1>
    </section>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/beaches/:slug" element={<BeachPage />} />
          <Route path="/map" element={<Suspense fallback={<MapLoading />}><MapPage /></Suspense>} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
