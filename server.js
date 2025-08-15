import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" })); // dodany limit

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
    // obsługa sytuacji, gdy brak choices lub odpowiedzi
    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(500).json({ error: "Brak odpowiedzi od OpenAI", details: data });
    }

    res.json({ result: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: "Coś poszło nie tak", details: err.message });
  }
});

// prosty endpoint GET do sprawdzenia czy serwer żyje
app.get("/", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend działa na porcie ${PORT}!`));
