
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import App from './AppRoot';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

window.addEventListener('error', (event) => {
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.style.padding = '20px';
  errorDiv.style.fontSize = '20px';
  errorDiv.style.whiteSpace = 'pre-wrap';
  errorDiv.textContent = `Error: ${event.message}\n${event.error?.stack}`;
  document.body.prepend(errorDiv);
});

window.addEventListener('unhandledrejection', (event) => {
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.style.padding = '20px';
  errorDiv.style.fontSize = '20px';
  errorDiv.style.whiteSpace = 'pre-wrap';
  errorDiv.textContent = `Promise Rejection: ${event.reason}`;
  document.body.prepend(errorDiv);
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <App />
);
