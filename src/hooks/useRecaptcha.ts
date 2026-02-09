import { useState, useEffect, useCallback } from 'react';

const RECAPTCHA_SITE_KEY = '6Le2q2EsAAAAALT1XXCEYyPsT3gfauLb_0JgYXs7';

declare global {
  interface Window {
    grecaptcha: {
      ready?: (callback: () => void) => void;
      execute?: (siteKey: string, options: { action: string }) => Promise<string>;
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

interface UseRecaptchaReturn {
  isReady: boolean;
  executeRecaptcha: (action: string) => Promise<string | null>;
}

export function useRecaptcha(): UseRecaptchaReturn {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if Enterprise script is already loaded
    if (window.grecaptcha?.enterprise) {
      window.grecaptcha.enterprise.ready(() => setIsReady(true));
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="recaptcha/enterprise.js"]');
    if (existingScript) {
      const checkReady = setInterval(() => {
        if (window.grecaptcha?.enterprise) {
          window.grecaptcha.enterprise.ready(() => {
            setIsReady(true);
            clearInterval(checkReady);
          });
        }
      }, 100);
      return () => clearInterval(checkReady);
    }

    // Load reCAPTCHA Enterprise script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      window.grecaptcha.enterprise.ready(() => setIsReady(true));
    };

    script.onerror = () => {
      console.error('Failed to load reCAPTCHA Enterprise script');
    };

    document.head.appendChild(script);
  }, []);

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    if (!isReady || !window.grecaptcha?.enterprise) {
      console.error('reCAPTCHA Enterprise not ready');
      return null;
    }

    try {
      const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action });
      return token;
    } catch (error) {
      console.error('Error executing reCAPTCHA:', error);
      return null;
    }
  }, [isReady]);

  return { isReady, executeRecaptcha };
}
