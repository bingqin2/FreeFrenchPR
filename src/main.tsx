import { StrictMode, lazy, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import Layout from './components/Layout';
import Home from './pages/Home';
import { Loading } from './components/ui';

// Hash routing works on GitHub Pages without server-side rewrites.
const Learn = lazy(() => import('./pages/Learn'));
const LessonPage = lazy(() => import('./pages/LessonPage'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const Practice = lazy(() => import('./pages/Practice'));
const Writing = lazy(() => import('./pages/Writing'));
const Speaking = lazy(() => import('./pages/Speaking'));
const Exam = lazy(() => import('./pages/Exam'));
const Dictionary = lazy(() => import('./pages/Dictionary'));
const Guides = lazy(() => import('./pages/Guides'));
const Progress = lazy(() => import('./pages/Progress'));
const About = lazy(() => import('./pages/About'));

const s = (el: ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'learn', element: s(<Learn />) },
      { path: 'learn/:id', element: s(<LessonPage />) },
      { path: 'flashcards', element: s(<Flashcards />) },
      { path: 'practice/:skill', element: s(<Practice />) },
      { path: 'writing', element: s(<Writing />) },
      { path: 'writing/:id', element: s(<Writing />) },
      { path: 'speaking', element: s(<Speaking />) },
      { path: 'speaking/:id', element: s(<Speaking />) },
      { path: 'exam', element: s(<Exam />) },
      { path: 'dictionary', element: s(<Dictionary />) },
      { path: 'guides', element: s(<Guides />) },
      { path: 'guides/:id', element: s(<Guides />) },
      { path: 'progress', element: s(<Progress />) },
      { path: 'about', element: s(<About />) },
      { path: '*', element: <Home /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
