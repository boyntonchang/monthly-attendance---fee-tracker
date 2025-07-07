import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';

interface AuthModalProps {
  show: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ show, onClose }) => {
  if (!show) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'rgb(79, 70, 229)',
                  brandAccent: 'rgb(99, 102, 241)',
                  defaultButtonBackground: '#1e293b',
                  defaultButtonBackgroundHover: '#334155',
                  inputBackground: '#0f172a',
                  inputBorder: '#334155',
                  inputBorderHover: 'rgb(79, 70, 229)',
                  inputText: 'white',
                  messageText: '#9ca3af',
                  anchorTextColor: '#cbd5e1',
                  anchorTextHoverColor: 'rgb(129, 140, 248)',
                },
                space: {
                  spaceSmall: '4px',
                  spaceMedium: '8px',
                  spaceLarge: '16px',
                },
                radii: {
                  borderRadiusButton: '0.375rem',
                  buttonBorderRadius: '0.375rem',
                  inputBorderRadius: '0.375rem',
                }
              },
            },
          }}
          providers={[]}
          theme="dark"
        />
      </div>
    </div>
  );
};