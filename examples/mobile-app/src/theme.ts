export const theme = {
    colors: {
        background: '#0d0d0f',
        surface: '#16161a',
        surfaceSubtle: '#1f1f24',
        border: '#2a2a2f',
        textPrimary: '#f5f6f7',
        textSecondary: '#9ca3af',
        textMuted: '#6b7280',
        accent: '#1DB954',
        accentText: '#000000',
        overlay: 'rgba(0,0,0,0.45)',
        danger: '#ff6b6b',
    },
    spacing: (n: number) => n * 4,
    radius: {
        sm: 6,
        md: 10,
        lg: 14,
    },
    typography: {
        title: { fontSize: 22, fontWeight: '700' as const, color: '#f5f6f7' },
        subtitle: { fontSize: 16, fontWeight: '600' as const, color: '#f5f6f7' },
        body: { fontSize: 14, fontWeight: '400' as const, color: '#f5f6f7' },
    },
};
