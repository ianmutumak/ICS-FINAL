import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyTheme, readTheme } from './lib/theme';

// Set the theme before the first screen is drawn, so a person who chose dark mode does not see a light flash.
applyTheme(readTheme());

createRoot(document.getElementById('root')!).render(<App />);
