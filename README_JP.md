# Chrome 拡張機能 MCP サーバー

Chrome ブラウザの API を Claude から操作できるようにするための MCP サーバーです。

## インストール

### 1. Chrome 拡張機能のインストール

1.Chrome にインストール:

- Chrome で`chrome://extensions/`を開く
- 右上の「デベロッパーモード」を有効にする
- 「パッケージ化されていない拡張機能を読み込む」をクリックし、展開したディレクトリを選択

#### 手動インストール

1. 拡張機能のディレクトリに移動:

```bash
cd src/chromeextension/extension
```

2. Chrome に読み込む:
   - Chrome で`chrome://extensions/`を開く
   - 右上の「デベロッパーモード」を有効にする
   - 「パッケージ化されていない拡張機能を読み込む」をクリックし、拡張機能のディレクトリを選択

### 2. MCP サーバーの設定

`claude_desktop_config.json`に以下を追加:

#### npx の場合

```json
{
  "mcpServers": {
    "chromeextension": {
      "command": "node",
      "args": ["/Users/kenn/Developer/github/chromeextension/dist/index.js"],
      "env": {
        "CHROME_EXTENSION_ID": "ecnaempopkihhmjcpbiggppaoaemgfkd"
      }
    }
  }
}
```

#### docker の場合

```json
{
  "mcpServers": {
    "chromeextension": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "CHROME_EXTENSION_ID",
        "mcp/chromeextension"
      ],
      "env": {
        "CHROME_EXTENSION_ID": "your-extension-id"
      }
    }
  }
}
```

## ツール一覧

1. `chrome_get_active_tab`

   - 現在アクティブなタブの情報を取得
   - 戻り値: アクティブタブの URL、タイトル、タブ ID などの情報
   - 使用する Chrome API: `chrome.tabs.query({ active: true, currentWindow: true })`

2. `chrome_get_all_tabs`

   - すべての開いているタブの情報を取得
   - 戻り値: すべてのタブの情報（URL、タイトル、タブ ID など）のリスト
   - 使用する Chrome API: `chrome.tabs.query({})`
   - WebSocket イベントによるリアルタイムのタブ更新情報も提供:
     - `created`: 新しいタブが作成された時
     - `updated`: タブの内容が更新された時
     - `removed`: タブが閉じられた時
     - `activated`: タブがアクティブになった時

3. `chrome_execute_script`

   - Web ページ上で DOM 操作を実行
   - 必須パラメータ:
     - `tab_id` (number): 対象タブの ID
     - `operation` (object): DOM 操作の詳細
   - 操作の構造:
     ```typescript
     {
       action: string;  // 実行する操作の種類
       selector?: string;  // 要素を特定するCSSセレクタ
       value?: string | number | boolean;  // 設定する値
       attribute?: string;  // 属性名
       tagName?: string;  // createElement用のタグ名
       attributes?: Record<string, string | number | boolean>;  // 要素の属性
       innerText?: string;  // テキストコンテンツ
       elementId?: string;  // appendChild用の要素ID
       message?: string;  // log操作用のメッセージ
     }
     ```
   - サポートされている操作:
     - `querySelector`: 要素の情報を取得
     - `setText`: テキストコンテンツを設定
     - `createElement`: 新しい要素を作成
     - `click`: 要素のクリックイベントを発火
     - その他: querySelectorAll, setHTML, setAttribute, removeAttribute, addClass, removeClass, toggleClass, appendChild, removeElement, getPageInfo, getElementsInfo, log

4. `chrome_inject_css`

   - Web ページに CSS を注入
   - 必須パラメータ:
     - `tab_id` (number): 対象タブの ID
     - `css` (string): 注入する CSS コード

5. `chrome_get_extension_info`

   - インストールされている拡張機能の情報を取得
   - オプションパラメータ:
     - `extension_id` (string): 特定の拡張機能 ID

6. `chrome_send_message`

   - 拡張機能のバックグラウンドスクリプトにメッセージを送信
   - 必須パラメータ:
     - `extension_id` (string): 対象の拡張機能 ID
     - `message` (object): 送信するメッセージ

7. `chrome_get_cookies`

   - 特定ドメインの Cookie を取得
   - 必須パラメータ:
     - `domain` (string): 対象ドメイン

8. `chrome_capture_screenshot`
   - 現在のタブのスクリーンショットを撮影
   - オプションパラメータ:
     - `tab_id` (number): 対象タブの ID（デフォルトはアクティブタブ）
     - `format` (string): 画像フォーマット（'png'または'jpeg'、デフォルトは'png'）
     - `quality` (number): jpeg フォーマットの画質（0-100）
     - `area` (object): キャプチャする領域 {x, y, width, height}

## セットアップ

1. Chrome 拡張機能の作成:

   - 拡張機能用の新しいディレクトリを作成
   - 必要な権限を含む`manifest.json`ファイルを作成
   - 必要なバックグラウンドスクリプトを実装

2. 必要な権限:
   manifest.json に以下の権限が必要です:
   ```json
   {
     "permissions": ["activeTab", "scripting", "cookies", "management", "tabs"]
   }
   ```

### トラブルシューティング

問題が発生した場合、以下を確認してください:

1. Chrome 拡張機能が正しくインストールされ、有効になっているか
2. manifest.json に必要な権限がすべて正しく指定されているか
3. 拡張機能 ID が正しく設定されているか
4. ブラウザが実行中でアクセス可能か

## ビルド

Docker ビルド:

```bash
docker build -t mcp/chromeextension -f src/chromeextension/Dockerfile .
```

## ライセンス

この MCP サーバーは MIT ライセンスの下で公開されています。これは、MIT ライセンスの条件に従って、ソフトウェアの使用、修正、配布が自由に行えることを意味します。詳細については、プロジェクトリポジトリの LICENSE ファイルを参照してください。
