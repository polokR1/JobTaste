import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");

app.post("/ask", async (req, res) => {
  try {
    const { prompt, files, images } = req.body;
    if (!prompt || !files) return res.status(400).json({ error: "Brak prompt lub files" });

    const filesList = Object.entries(files)
      .map(([name, content]) => `---\n${name}\n${content}`)
      .join("\n");
    const imagesList = images
      ? Object.entries(images)
          .map(([name, dataUrl]) => `---\n${name}\n${dataUrl.slice(0,40)}...`)
          .join("\n")
      : "";

    // Nowy prompt systemowy – AI ma odpowiedzieć w polu "message" i dać JSON z plikami (lub pusty jeśli nic nie zmienia)
    const userMessage = `Oto pliki projektu webowego (HTML, CSS, JS):\n${filesList}\n` +
                        (imagesList ? `Obrazki (dataURL):\n${imagesList}\n` : "") +
                        `\nInstrukcja: ${prompt}\n\n` +
                        `ODPOWIEDZ UŻYTKOWNIKOWI w polu "message" (to czat!), a następnie zwróć tylko zmodyfikowane pliki jako {"files": {"nazwa_pliku": "nowa zawartość", ...}}. Jeśli nie zmieniasz żadnych plików, "files" ma być pustym obiektem. Format odpowiedzi:\n` +
                        `{"message": "Twoja odpowiedź do użytkownika po polsku", "files": {"nazwa_pliku": "nowa zawartość"}}\n` +
                        `Nie dodawaj żadnych komentarzy, nie używaj bloków kodu, zwróć tylko czysty JSON.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: `Jesteś asystentem pomagającym w modyfikacji prostych projektów webowych (HTML, CSS, JS). Najpierw ODPOWIEDZ użytkownikowi w polu "message" (czat) – wyjaśnij, co zrobiłeś, podsumuj zmiany lub odpowiedz na pytanie. Następnie zwróć tylko zmodyfikowane pliki jako {"files": {"nazwa_pliku": "nowa zawartość"}}. Jeśli nie zmieniasz plików, "files" musi być pustym obiektem. Nie dodawaj żadnych opisów poza polem "message", nie używaj bloków kodu ani komentarzy. Odpowiedź musi być pojedynczym czystym JSONem.` },
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();
    console.log("OPENAI DATA:", data);
    const resultText = data.choices?.[0]?.message?.content || "";
    console.log("Tekst od AI:", resultText);

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
