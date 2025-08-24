import express from "express";
import line from "@line/bot-sdk";
import OpenAI from "openai";

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();

// LINE Webhook入口
app.post("/api/webhook", line.middleware(config), async (req, res) => {
  try {
    const results = await Promise.all((req.body.events || []).map(handleEvent));
    return res.json(results);
  } catch (e) {
    console.error("webhook error:", e);
    return res.status(500).send("error");
  }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }
  const userText = (event.message.text || "").trim();

  const prompt = `
あなたは中小企業向けの業務効率化ソリューション提案アシスタントです。
ユーザーのお困りごとに対し、今日から試せる現実的な解決案を日本語で簡潔に提案してください。

出力:
- 課題要約（1行）
- 解決案（最大3つ・箇条書き）
  - 使うツール
  - 実装ステップ（3〜5手順）
  - 概算コスト/工数
- 可能ならPoCのやり方を一言

相談文: 「${userText}」
`.trim();

  let answer = "提案の生成に失敗しました。もう一度お試しください。";
  try {
    const completion = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        { role: "system", content: "冗長にせず具体的に答えるコンサル。" },
        { role: "user", content: prompt }
      ]
    });
    answer = completion.choices?.[0]?.message?.content?.trim() || answer;
  } catch (e) {
    console.error("AI error:", e);
    answer = "AI提案の生成でエラー。キーワード（請求書/予約/レポート等）で再入力してください。";
  }

  return client.replyMessage(event.replyToken, [
    { type: "text", text: "🔎 お困り事を分析しました。提案をお送りします。" },
    { type: "text", text: answer.slice(0, 5000) }
  ]);
}

// ヘルスチェック用（動作確認しやすくする）
app.get("/api/health", (_, res) => res.status(200).send("ok"));

// Vercel用エクスポート
export default function handler(req, res) {
  return app(req, res);
}