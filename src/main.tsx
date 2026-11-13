import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installPersistentSessionFetchInterceptor } from './services/sessionFetch';

installPersistentSessionFetchInterceptor();

createRoot(document.getElementById('root')!).render(<App />);
