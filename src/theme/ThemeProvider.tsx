import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Colors = {
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
};

const darkColors: Colors = {
  background: '#020617', // slate-950
  card: '#0f172a',       // slate-900
  text: '#ffffff',
  textMuted: '#94a3b8',
  border: '#1e293b',
  primary: '#10b981',    // emerald-500
};

const lightColors: Colors = {
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  primary: '#10b981',
};

type ThemeType = 'light' | 'dark' | 'system';

type ThemeContextType = {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  colors: Colors;
  isDark: boolean;
  isLoaded: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@monetigia_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemTheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeType>('dark'); 
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedTheme) => {
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemeState(savedTheme);
        }
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load theme preference:", err);
        setIsLoaded(true); // Default to dark theme on error
      });
  }, []);

  const setTheme = async (newTheme: ThemeType) => {
    const prevTheme = theme;
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (err) {
      console.error("Failed to save theme preference:", err);
      setThemeState(prevTheme); // Revert on failure
    }
  };
  
  const isDark = theme === 'system' ? systemTheme === 'dark' : theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors, isDark, isLoaded }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
