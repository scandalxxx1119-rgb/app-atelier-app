# ターミナルA: App Store申請準備

## 作業ディレクトリ
`C:\dev\app-atelier-app`

## 概要
App Atelier（Expo/React Native）をApp Store・Google Playに申請するための準備を行う。

---

## タスク1: アイコン確認・設定

`assets/` ディレクトリを確認し、以下が揃っているか確認する:
- `icon.png` (1024x1024 PNG, 角丸なし)
- `adaptive-icon.png` (Android用, 1024x1024)
- `splash.png` (スプラッシュ画面)

不足していれば、プレースホルダーを作成するか、ユーザーに確認する。

app.json に以下が設定されているか確認:
```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    }
  }
}
```

---

## タスク2: app.json の申請情報を補完

以下の情報を app.json に追加・確認する:

```json
{
  "expo": {
    "name": "App Atelier",
    "slug": "app-atelier-app",
    "version": "1.0.0",
    "description": "個人開発者がアプリを投稿・発信・応援できる日本語特化コミュニティ",
    "ios": {
      "bundleIdentifier": "com.appatelier.app",
      "buildNumber": "1",
      "supportsTablet": true
    },
    "android": {
      "package": "com.appatelier.app",
      "versionCode": 1
    }
  }
}
```

---

## タスク3: EAS Build実行（iOSシミュレータ用）

まずローカルで動作確認:
```bash
cd C:\dev\app-atelier-app
npx expo start
```

問題なければ本番ビルド:
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

---

## タスク4: App Store Connect申請情報準備

以下のテキストをまとめておく（App Store Connectの入力欄用）:

**アプリ名:** App Atelier

**サブタイトル:** 個人開発者のためのコミュニティ

**説明文:**
```
App Atelierは、個人開発者がアプリを投稿・発信・応援できる日本語特化コミュニティです。

【主な機能】
• アプリ投稿・発見: 個人開発アプリを投稿して多くのユーザーに届けよう
• いいね・コメント: 気に入ったアプリを応援しよう
• テスター募集: アプリのテスターを募集・申請できる
• 掲示板: 「こんなアプリが欲しい」を開発者に伝えよう
• ランキング: 人気アプリをチェック
• ポイントシステム: 活動に応じてポイントを獲得
• ログインボーナス: 毎日ログインでポイントゲット
```

**キーワード:** 個人開発,アプリ,コミュニティ,開発者,プログラミング,ポートフォリオ,インディー

**カテゴリー:** ソーシャルネットワーキング（メイン）/ 仕事効率化（サブ）

**プライバシーポリシーURL:** https://app-atelier.vercel.app/privacy

**サポートURL:** https://app-atelier.vercel.app

---

## 注意事項
- pushは「pushして」と言われるまでしない
- commitはしてOK
- ビルドエラーが出たら内容をユーザーに報告する
