import type { AppData } from '../types';

declare var google: any;
declare var gapi: any;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email';
const FILE_NAME = 'donburi_data.json';
const STORAGE_KEY = 'donburi_auth_session_v2';

let tokenClient: any;
let initPromise: Promise<void> | null = null;

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement;
    if (existingScript) {
      if (existingScript.getAttribute('data-loaded') === 'true') {
        resolve();
      } else {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error(`Script load error: ${src}`)));
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () => reject(new Error(`Script load error: ${src}`));
    document.body.appendChild(script);
  });
};

const getStoredSession = () => {
  const session = localStorage.getItem(STORAGE_KEY);
  if (!session) return null;
  try {
    const parsed = JSON.parse(session);
    if (parsed.expiresAt < Date.now() + 5 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const initGoogleApi = async () => {
  if (!CLIENT_ID) {
    console.error('VITE_GOOGLE_CLIENT_ID is missing');
    return;
  }

  if (!initPromise) {
    initPromise = (async () => {
      await Promise.all([
        loadScript('https://apis.google.com/js/api.js'),
        loadScript('https://accounts.google.com/gsi/client')
      ]);

      await new Promise<void>((resolve) => {
        gapi.load('client', async () => {
          await gapi.client.init({
            discoveryDocs: [DISCOVERY_DOC],
          });
          resolve();
        });
      });

      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error !== undefined) throw response;
          
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` }
          });
          const userInfo = await userInfoRes.json();
          const email = userInfo.email || 'unknown_user';

          const expiresAt = Date.now() + (parseInt(response.expires_in) * 1000);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            token: response.access_token,
            email: email,
            expiresAt: expiresAt
          }));

          if ((window as any)._onGoogleAuthSuccess) {
            await (window as any)._onGoogleAuthSuccess(email);
          }
        },
      });
    })();
  }
  return initPromise;
};

export const tryRestoreSession = async (): Promise<string | null> => {
  const session = getStoredSession();
  if (session) {
    // 保存されたトークンをgapiクライアントに設定
    if (typeof gapi !== 'undefined' && gapi.client) {
      gapi.client.setToken({ access_token: session.token });
    }
    return session.email;
  }
  return null;
};

export const login = () => {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }
};

export const logout = () => {
  // 1. ストレージからセッション情報を即座に削除
  localStorage.removeItem(STORAGE_KEY);
  
  // 2. gapiクライアントからトークンを即座に破棄（403エラーの主な原因）
  if (typeof gapi !== 'undefined' && gapi.client) {
    const token = gapi.client.getToken();
    if (token) {
      // revokeのコールバックを待たずに、まずクライアント上のトークンを消去する
      gapi.client.setToken(null);
      // Googleサーバー側のトークンも無効化
      google.accounts.oauth2.revoke(token.access_token, () => {
        console.log('Token revoked');
      });
    }
  }
};

const findFileId = async (): Promise<string | null> => {
  const response = await gapi.client.drive.files.list({
    spaces: 'appDataFolder',
    fields: 'files(id, name)',
    pageSize: 10,
  });
  const files = response.result.files;
  return files?.find((f: any) => f.name === FILE_NAME)?.id || null;
};

export const loadAppData = async (): Promise<AppData | null> => {
  const fileId = await findFileId();
  if (!fileId) return null;
  const response = await gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media',
  });
  return typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
};

export const saveAppData = async (data: AppData): Promise<void> => {
  const fileId = await findFileId();
  const token = gapi.client.getToken()?.access_token;
  if (!token) return;

  const metadata = { name: FILE_NAME, parents: fileId ? undefined : ['appDataFolder'] };
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const body = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
               delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(data) + close_delim;

  const url = fileId ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
};