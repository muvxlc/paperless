// OIDC utility services for ThaID and Authentik OIDC authentication

export const getFrontendUrl = (requestHeaders: Record<string, string>) => {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  // Try to determine frontend URL from headers or fallback
  const host = requestHeaders['host'] || 'localhost:3000';
  const protocol = requestHeaders['x-forwarded-proto'] || 'http';
  
  // If we are on production, the custom portal base domain is the same for frontend and backend
  return `${protocol}://${host}`;
};

// --- ThaID Integration ---
export const getThaIDAuthUrl = () => {
  const baseUrl = process.env.THAID_BASE_URL || 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/';
  const clientId = process.env.THAID_CLIENT_ID;
  const redirectUri = process.env.THAID_CALLBACK_URL || process.env.THAID_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    throw new Error('ThaID client ID or redirect URI is not configured');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: process.env.THAID_SCOPE || 'openid pid name',
    state: 'thaid_login' 
  });

  return `${baseUrl}?${params.toString()}`;
};

export const exchangeThaIDCode = async (code: string) => {
  const tokenUrl = process.env.THAID_TOKEN_URL || 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/';
  const clientId = process.env.THAID_CLIENT_ID;
  const clientSecret = process.env.THAID_CLIENT_SECRET;
  const redirectUri = process.env.THAID_CALLBACK_URL || process.env.THAID_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('ThaID credentials or redirect URI is not configured');
  }

  const auth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    }).toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ThaID token exchange failed: ${response.statusText}. Details: ${errorText}`);
  }

  return response.json(); // { access_token, id_token, ... }
};

export const getThaIDUserInfo = async (accessToken: string) => {
  const userinfoUrl = process.env.THAID_USERINFO_URL || 'https://imauth.bora.dopa.go.th/api/v2/oauth2/userinfo/';

  const response = await fetch(userinfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`ThaID userinfo fetch failed: ${response.statusText}`);
  }

  return response.json(); // Should contain pid, name, etc.
};

// --- Authentik Integration ---
export const getAuthentikAuthUrl = () => {
  const baseUrl = process.env.AUTHENTIK_BASE_URL; // https://auth.bangkhan.com
  const clientId = process.env.AUTHENTIK_CLIENT_ID;
  const redirectUri = process.env.AUTHENTIK_CALLBACK_URL;
  
  if (!baseUrl || !clientId || !redirectUri) {
    throw new Error('Authentik base URL, client ID or redirect URI is not configured');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state: 'authentik_login' 
  });

  return `${baseUrl}/application/o/authorize/?${params.toString()}`;
};

export const exchangeAuthentikCode = async (code: string) => {
  const baseUrl = process.env.AUTHENTIK_BASE_URL;
  const tokenUrl = `${baseUrl}/application/o/token/`;
  const clientId = process.env.AUTHENTIK_CLIENT_ID;
  const clientSecret = process.env.AUTHENTIK_CLIENT_SECRET;
  const redirectUri = process.env.AUTHENTIK_CALLBACK_URL;

  if (!baseUrl || !clientId || !clientSecret || !redirectUri) {
    throw new Error('Authentik configuration is missing');
  }

  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: bodyParams.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Authentik token exchange failed: ${response.statusText}. Details: ${errorText}`);
  }

  return response.json(); // { access_token, id_token, ... }
};

export const getAuthentikUserInfo = async (accessToken: string) => {
  const baseUrl = process.env.AUTHENTIK_BASE_URL;
  const userinfoUrl = `${baseUrl}/application/o/userinfo/`;

  const response = await fetch(userinfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Authentik userinfo fetch failed: ${response.statusText}`);
  }

  return response.json(); // Should contain sub, preferred_username, email, groups, etc.
};
