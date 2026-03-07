import type { AppData } from '../types';

// 型定義がない環境でもエラーにならないようグローバル変数を宣言
declare var google: any;
declare var gapi: any;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
// メールアドレス取得のためのスコープを追加
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email';
const FILE_NAME = 'donburi_data.json';

let tokenClient: any;

// 初期化の二重実行を防ぐためのPromiseキャッシュ
let initPromise: Promise<void> | null = null;

/**
 * 外部のスクリプトを動的に読み込むユーティリティ関数
 */
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

/**
 * GAPIとGSIを初期化する
 */
export const initGoogleApi = async (onAuthSuccess: (email: string) => void) => {
  if (!CLIENT_ID) {
    console.error('VITE_GOOGLE_CLIENT_ID が設定されていません。');
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
          if (response.error !== undefined) {
            throw response;
          }

          // アクセストークンを使用してユーザー情報を取得
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` }
            });
            const userInfo = await userInfoRes.json();
            const email = userInfo.email || 'unknown_user';

            if (typeof window !== 'undefined' && (window as any)._onGoogleAuthSuccess) {
              (window as any)._onGoogleAuthSuccess(email);
            }
          } catch (err) {
            console.error('User info fetch error', err);
            if (typeof window !== 'undefined' && (window as any)._onGoogleAuthSuccess) {
              (window as any)._onGoogleAuthSuccess('authenticated_user');
            }
          }
        },
      });
    })();
  }

  try {
    (window as any)._onGoogleAuthSuccess = onAuthSuccess;
    await initPromise;
  } catch (error) {
    initPromise = null;
    console.error('Google API の初期化に失敗しました:', error);
    throw error;
  }
};

/**
 * ログイン（ポップアップ）処理を実行
 */
export const login = () => {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    console.error('Token client is not initialized');
  }
};

/**
 * ログアウト処理
 */
export const logout = () => {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken('');
    });
  }
};

const findFileId = async (): Promise<string | null> => {
  try {
    const response = await gapi.client.drive.files.list({
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
      pageSize: 10,
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      const file = files.find((f: any) => f.name === FILE_NAME);
      return file ? file.id : null;
    }
    return null;
  } catch (err) {
    console.error('File search error', err);
    return null;
  }
};

export const loadAppData = async (): Promise<AppData | null> => {
  const fileId = await findFileId();
  if (!fileId) return null;

  try {
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });
    return typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
  } catch (err) {
    console.error('Data load error', err);
    return null;
  }
};

export const saveAppData = async (data: AppData): Promise<void> => {
  const fileId = await findFileId();
  const token = gapi.client.getToken().access_token;
  
  const metadata = {
    name: FILE_NAME,
    parents: fileId ? undefined : ['appDataFolder'],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(data) +
    close_delim;

  const url = fileId 
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = fileId ? 'PATCH' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      throw new Error('Failed to save data to Google Drive');
    }
  } catch (err) {
    console.error('Data save error', err);
    throw err;
  }
};