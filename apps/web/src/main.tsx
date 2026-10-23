import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createNexoraTheme, type AppearanceMode } from './theme/theme';
import { App } from './app/App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Nexora CRM could not find its root element. Check apps/web/index.html.');

class StartupErrorBoundary extends React.Component<React.PropsWithChildren, { error: string | null }> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 680, margin: '12vh auto', padding: 24, color: '#0F172A' }}><h1>Nexora CRM could not start</h1><p>{this.state.error}</p><p>Check that dependencies are installed and run the app with <code>npm run dev</code> from the project folder.</p></main>;
    }
    return this.props.children;
  }
}

function Root(){
  const [appearance,setAppearance]=useState<AppearanceMode>(()=>{try{return (localStorage.getItem('nexora-theme-mode') as AppearanceMode)||'auto';}catch{return 'auto';}});
  const [systemDark,setSystemDark]=useState(()=>window.matchMedia?.('(prefers-color-scheme: dark)').matches??false);
  useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');const change=()=>setSystemDark(media.matches);media.addEventListener('change',change);const custom=(event:Event)=>setAppearance((event as CustomEvent<AppearanceMode>).detail);window.addEventListener('nexora-appearance-change',custom);return()=>{media.removeEventListener('change',change);window.removeEventListener('nexora-appearance-change',custom);};},[]);
  const theme=useMemo(()=>createNexoraTheme(appearance==='auto'?(systemDark?'dark':'light'):appearance),[appearance,systemDark]);
  return <StartupErrorBoundary><ThemeProvider theme={theme}><CssBaseline /><App /></ThemeProvider></StartupErrorBoundary>;
}
ReactDOM.createRoot(rootElement).render(<React.StrictMode><Root/></React.StrictMode>);
