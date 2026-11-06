import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/sallas/tokens/sallas.tokens.css';
import './styles/sallas/css/components.css';
import './styles/redhat/fonts.css';
import './styles/app.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
