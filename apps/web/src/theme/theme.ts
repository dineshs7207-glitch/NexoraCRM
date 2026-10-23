import { createTheme } from '@mui/material/styles';

export const tokens = {
  navy900: '#0A1A3A', navy800: '#10244F', primary600: '#2563EB', primary500: '#3B82F6',
  primary50: '#EFF6FF', page: '#F4F7FB', surface: '#FFFFFF', border: '#E5EAF2',
  text: '#0F172A', secondary: '#64748B', success: '#16A34A', warning: '#F59E0B',
  danger: '#DC2626', purple: '#7C3AED', teal: '#0891B2',
} as const;

export type AppearanceMode = 'light'|'dark'|'auto';
export const createNexoraTheme = (mode:'light'|'dark') => {
  const dark=mode==='dark';
  const border=dark?'#26354A':tokens.border;
  const surface=dark?'#111D31':tokens.surface;
  return createTheme({
  palette: { mode, primary: { main: tokens.primary600 }, secondary: { main: tokens.navy900 }, background: { default: dark?'#0B1220':tokens.page, paper: surface }, text: { primary: dark?'#E5EDF7':tokens.text, secondary: dark?'#AAB7CA':tokens.secondary }, divider:border, success: { main: tokens.success }, warning: { main: tokens.warning }, error: { main: tokens.danger } },
  typography: { fontFamily: 'Inter, system-ui, sans-serif', h1: { fontSize: 24, lineHeight: '32px', fontWeight: 600 }, h2: { fontSize: 18, lineHeight: '28px', fontWeight: 600 }, h3: { fontSize: 16, lineHeight: '24px', fontWeight: 600 }, body1: { fontSize: 14, lineHeight: '20px' }, caption: { fontSize: 12, lineHeight: '16px', fontWeight: 500 }, button: { textTransform: 'none', fontWeight: 600 } },
  shape: { borderRadius: 12 },
  components: { MuiCssBaseline:{styleOverrides:{':root':{'--nexora-border':border},body:{backgroundColor:dark?'#0B1220':tokens.page},'.recharts-default-tooltip':{backgroundColor:`${surface} !important`,border:`1px solid ${border} !important`,borderRadius:'8px',color:`${dark?'#E5EDF7':tokens.text} !important`},'.recharts-tooltip-label,.recharts-tooltip-item,.recharts-tooltip-item-name,.recharts-tooltip-item-value':{color:`${dark?'#E5EDF7':tokens.text} !important`}}},MuiCard: { styleOverrides: { root: { border: `1px solid ${border}`, boxShadow: dark?'0 1px 2px rgba(0,0,0,.25)':'0 1px 2px rgba(16,24,40,.06)' } } }, MuiButton: { styleOverrides: { root: { borderRadius: 8, minHeight: 40 } } } },
  });
};
export const theme = createNexoraTheme('light');
