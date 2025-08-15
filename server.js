import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json()); // zamiast body-parser

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");
}

app.post("/ask", async (req, res) => {
  try {
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

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    res.json({ result: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "Coś poszło nie tak", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend działa na porcie ${PORT}!`));
