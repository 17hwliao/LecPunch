import React from 'react';
import ReactDOM from 'react-dom/client';
import { LogtoProvider, UserScope } from '@logto/react';
import { App } from './app/App';
import { logtoAppId, logtoEndpoint, logtoResource } from './shared/auth/logto';
import './app/styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <LogtoProvider
      config={{
        endpoint: logtoEndpoint,
        appId: logtoAppId,
        resources: [logtoResource],
        scopes: [UserScope.Organizations, 'studio:access', 'studio:admin:access']
      }}
    >
      <App />
    </LogtoProvider>
  </React.StrictMode>
);
