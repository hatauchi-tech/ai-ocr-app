import React from 'react';
import { createRoot } from 'react-dom/client';
import DynamicApp from './DynamicApp'; // 汎用OCRシステムを使用
// import App from './App'; // 旧版（固定スキーマ）も利用可能

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <DynamicApp />
  </React.StrictMode>
);