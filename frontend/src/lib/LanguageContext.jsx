import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  // Try to get language from localStorage, default to 'en'
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('sentria_lang') || 'en';
  });

  // Function to change language and save to localStorage
  const changeLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('sentria_lang', newLang);
  };

  // Translation helper function
  const t = (key) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
