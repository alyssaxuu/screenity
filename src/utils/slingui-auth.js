// src/utils/slingui-auth.js

const config = {
  authority: 'https://api.slingui.com/auth/oidc',
  client_id: 'screenity-extension',
  scope: 'openid profile email',
};

// --- PKCE and State Utility Functions ---

function generateRandomString() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(digest);
}

function getRedirectUrl() {
  if (chrome && chrome.identity) {
    return chrome.identity.getRedirectURL('callback.html');
  }
  // Fallback for development
  return 'http://localhost:3000/callback.html';
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error parsing JWT", e);
        return null;
    }
}

// --- Main Authentication Logic ---

export function login() {
  return new Promise(async (resolve, reject) => {
    const redirectURL = getRedirectUrl();
    const tokenEndpoint = `${config.authority}/token`;

    const codeVerifier = generateRandomString();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString();

    // Store verifier and state to use them after the redirect
    chrome.storage.local.set({
      auth_code_verifier: codeVerifier,
      auth_state: state
    });

    const authParams = new URLSearchParams({
      client_id: config.client_id,
      response_type: 'code',
      redirect_uri: redirectURL,
      scope: config.scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
    });

    const authURL = `${config.authority}/auth?${authParams.toString()}`;
    console.log('Launching auth flow:', authURL);
    chrome.identity.launchWebAuthFlow({ url: authURL, interactive: true }, async (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        return reject(new Error(chrome.runtime.lastError?.message || "Authentication flow failed."));
      }

      try {
        const url = new URL(responseUrl);
        const authCode = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        const { auth_state, auth_code_verifier } = await new Promise(resolve => {
          chrome.storage.local.get(['auth_state', 'auth_code_verifier'], result => resolve(result));
        });

        if (returnedState !== auth_state) {
          throw new Error('State mismatch: possible CSRF attack');
        }

        if (!authCode) {
          const error = url.searchParams.get('error');
          throw new Error(`Authorization failed: ${error}`);
        }

        const tokenParams = new URLSearchParams({
          client_id: config.client_id,
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: redirectURL,
          code_verifier: auth_code_verifier,
        });

        const tokenResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams.toString(),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(`Token exchange failed: ${errorData.error}`);
        }

        const tokens = await tokenResponse.json();
        const profile = parseJwt(tokens.id_token);
        const user = { ...tokens, profile };

        chrome.storage.local.set({ user: user }, () => {
          chrome.storage.local.remove(['auth_code_verifier', 'auth_state']);
          console.log('User profile stored');
          resolve(user);
        });

      } catch (error) {
        console.error('Auth error:', error.message);
        chrome.storage.local.remove(['auth_code_verifier', 'auth_state']);
        reject(error);
      }
    });
  });
}

export function isTokenExpired(user) {
  if (!user || !user.expires_at) {
    if (user && user.profile && user.profile.exp) {
      return Date.now() >= user.profile.exp * 1000;
    }
    return true;
  }
  return Date.now() >= user.expires_at * 1000;
}

export function getUser() {
  return new Promise((resolve) => {
    if (chrome && chrome.storage) {
      chrome.storage.local.get('user', (result) => {
        const user = result.user || null;
        if (user) {
          user.expired = isTokenExpired(user);
        }
        resolve(user);
      });
    } else {
      resolve(null);
    }
  });
}

export function logout() {
  return new Promise((resolve) => {
    if (chrome && chrome.storage) {
      chrome.storage.local.remove('user', () => {
        console.log('User logged out and data removed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}
