import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");

// Profesjonalny, wszechstronny prompt systemowy zgodny z polityką OpenAI
const SYSTEM_PROMPT = `
Jesteś profesjonalnym asystentem AI dla programisty. Udzielasz jasnych, praktycznych i przydatnych porad oraz wskazówek dotyczących programowania, projektowania, analizy i ulepszania kodu w różnych technologiach (frontend, backend, DevOps itp.). Możesz generować, modyfikować lub proponować pliki kodu, sugerować rozwiązania, analizować błędy, wyjaśniać zagadnienia i doradzać najlepsze praktyki.
Jeśli użytkownik prosi o zmiany w plikach – generuj tylko te pliki, które się zmieniły, jako {"files": {"nazwa_pliku": "nowa zawartość"}}.
W polu "message" zawsze napisz zwięzłą i profesjonalną odpowiedź dla użytkownika po polsku.
Nie generuj kodu ani sugestii niezgodnych z polityką OpenAI (np. kod szkodliwy, nielegalny, naruszający prywatność).
Nie masz natywnego dostępu do internetu – możesz sugerować użycie API, bibliotek, ale nie wykonujesz prawdziwych zapytań sieciowych.
`;

app.post("/ask", async (req, res) => {
  try {
    const { prompt, files, images } = req.body;
    if (!prompt || !files) return res.status(400).json({ error: "Brak prompt lub files" });

    const filesList = Object.entries(files)
      .map(([name, content]) => `---\n${name}\n${content}`)
      .join("\n");
    const imagesList = images
      ? Object.entries(images)
          .map(([name, dataUrl]) => `---\n${name}\n${dataUrl.slice(0, 40)}...`)
          .join("\n")
      : "";

    // Budowanie promptu wejściowego
    const userMessage =
      `Oto pliki projektu:\n${filesList}\n` +
      (imagesList ? `Obrazki (dataURL):\n${imagesList}\n` : "") +
      `\nInstrukcja: ${prompt}\n\n` +
      `Odpowiedz użytkownikowi w polu "message" oraz zwróć tylko zmienione pliki jako {"files": {"nazwa_pliku": "nowa zawartość"}}.\n` +
      `Format odpowiedzi: {"message": "Twoja odpowiedź po polsku", "files": { ... }}.\n` +
      `Nie dodawaj żadnych komentarzy, nie używaj bloków kodu, zwróć tylko czysty JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.4,
      }),
    });

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || "";

    let resultObj = {};
    try {
      // AI powinno dać czysty JSON: {"message": "...", "files": {...}}
      const jsonMatch = resultText.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        resultObj = JSON.parse(jsonMatch[0]);
      } else {
        resultObj = JSON.parse(resultText);
      }
    } catch (e) {
      return res.status(500).json({ error: "Błąd parsowania JSON od AI", raw: resultText });
    }
    res.json({ result: resultObj });
  } catch (err) {
    res.status(500).json({ error: "Coś poszło nie tak", details: err.message });
  }
});

app.get("/", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend działa na porcie ${PORT}!`));
