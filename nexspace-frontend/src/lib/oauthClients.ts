//import { PublicClientApplication, AuthenticationResult } from '@azure/msal-browser';
import { loadGoogleScript } from './loadGoogle';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient(opts: {
            client_id: string;
            scope: string;
            ux_mode?: 'popup' | 'redirect';
            redirect_uri?: string;
            callback: (resp: { code?: string; scope?: string } | any) => void;
          }): { requestCode: () => void };
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// const MS_CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID;
// const MS_TENANT = import.meta.env.VITE_MS_TENANT || 'common';

// ---------- Google (GIS OAuth Code Flow) ----------
export async function googleGetCode(): Promise<string | null> {
  await loadGoogleScript();

  return new Promise<string | null>((resolve) => {
    const client = window.google!.accounts!.oauth2!.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      ux_mode: 'popup',
      redirect_uri: 'postmessage', // standard GIS popup flow
      callback: (resp) => resolve(resp?.code ?? null),
    });
    client.requestCode();
  });
}

// ---------- Microsoft (MSAL – popup for ID token) ----------
// let msalApp: PublicClientApplication | null = null;
// function getMsal(): PublicClientApplication {
//   if (msalApp) return msalApp;
//   msalApp = new PublicClientApplication({
//     auth: {
//       clientId: MS_CLIENT_ID,
//       authority: `https://login.microsoftonline.com/${MS_TENANT}`,
//     },
//     cache: {
//       cacheLocation: 'sessionStorage',
//     },
//   });
//   return msalApp;
// }

// /**
//  * Acquire Microsoft ID token via popup.
//  * Backend must verify this ID token (issuer, audience = MS_CLIENT_ID, signature).
//  */
// export async function microsoftGetIdToken(): Promise<string | null> {
//   const app = getMsal();
//   // loginPopup returns AuthenticationResult with idToken
//   const result: AuthenticationResult = await app.loginPopup({
//     scopes: ['openid', 'email', 'profile'],
//     prompt: 'select_account',
//   });
//   return result.idToken ?? null;
// }
