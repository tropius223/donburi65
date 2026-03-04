import { AppData } from '../types';

// 型定義がない環境でもエラーにならないようグローバル変数を宣言
declare var google: any;
declare var gapi: any;

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'donburi_data.json';

let tokenClient: any;
let isGapiLoaded = false;
let isGsiLoaded = false;

/**
 * 外部のスクリプトを動的に読み込むユーティリティ関数
 */
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
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

  try {
    // 1. GAPIとGSIのスクリプトを読み込み
    await Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client')
    ]);

    // 2. GAPIクライアントの初期化
    await new Promise<void>((resolve) => {
      gapi.load('client', async () => {
        await gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        });
        isGapiLoaded = true;
        resolve();
      });
    });

    // 3. GSI（トークンクライアント）の初期化
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (response: any) => {
        if (response.error !== undefined) {
          throw response;
        }
        // ログイン成功時にユーザー情報を取得（簡易的にトークンから取得、またはGoogle People API等を使う手もあるが、
        // 今回はシンプルに認証完了のフラグとして扱う。厳密なメールアドレスはJWT(Credential)から取得可能）
        isGsiLoaded = true;
        onAuthSuccess('authenticated_user'); // 簡略化のため固定値。実運用ではデコードしたemailを渡す
      },
    });

  } catch (error) {
    console.error('Google API の初期化に失敗しました:', error);
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

/**
 * DriveのappDataFolderからファイルIDを検索する
 */
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

/**
 * アプリのデータを取得する
 */
export const loadAppData = async (): Promise<AppData | null> => {
  const fileId = await findFileId();
  if (!fileId) {
    return null; // データが存在しない場合
  }

  try {
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });
    // 取得した文字列をJSONとしてパースして返す
    return typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
  } catch (err) {
    console.error('Data load error', err);
    return null;
  }
};

/**
 * アプリのデータを保存する (Multipart upload)
 */
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

  // ファイルが既に存在すればPATCH（更新）、無ければPOST（新規作成）
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