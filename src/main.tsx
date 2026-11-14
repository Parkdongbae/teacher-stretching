import { createRoot } from 'react-dom/client';
import App from './App';
import { applyRandomBackground } from './lib/background';
import './styles.css';

applyRandomBackground();

const container = document.getElementById('root');
if (!container) {
  throw new Error('루트 엘리먼트를 찾을 수 없습니다.');
}

createRoot(container).render(<App />);
