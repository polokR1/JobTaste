import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/ask", async (req, res) => {
  const { prompt, code } = req.body;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Jesteś asystentem pomagającym w modyfikacji kodu HTML, CSS i JS." },
        { role: "user", content: `Oto kod:\n${code}\nInstrukcja:\n${prompt}` }
      ]
    })
  });

  const data = await response.json();
  res.json({ result: data.choices[0].message.content });
});

app.listen(process.env.PORT || 3000, () => console.log("Backend działa!"));
