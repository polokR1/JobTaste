import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';

const execPromise = util.promisify(exec);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' })); // Dla plików binarnych

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("Brak OPENAI_API_KEY w zmiennych środowiskowych!");

app.post("/ask", async (req, res) => {
  try {
    const { prompt, files } = req.body;
    if (!prompt || !files) return res.status(400).json({ error: "Brak prompt lub files" });

    const filesList = Object.entries(files)
      .map(([name, content]) => `---\n${name}\n${content}`)
      .join("\n");
    const userMessage = `Projekt Android APK. Pliki: ${filesList}\n\nInstrukcja: ${prompt}\n\nZwróć zmodyfikowane pliki jako JSON w formacie {"nazwa_pliku": "nowa zawartość", ...} – tylko te, które się zmieniły.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Jesteś asystentem pomagającym w modyfikacji projektów Android APK (XML, smali, itp.). Zawsze odpowiadaj JSON-em zawierającym tylko pliki, które się zmieniły." },
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });
    const resultText = data.choices?.[0]?.message?.content || "";
    let filesResult = {};
    try {
      const jsonMatch = resultText.match(/```json\s*([\s\S]+?)```/) || resultText.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        filesResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        filesResult = JSON.parse(resultText);
      }
    } catch (e) {
      return res.status(500).json({ error: "Błąd parsowania JSON od AI", raw: resultText });
    }
    res.json({ result: filesResult });
  } catch (err) {
    res.status(500).json({ error: "Coś poszło nie tak", details: err.message });
  }
});

app.post("/decode-apk", async (req, res) => {
  const apkBuffer = req.body;
  const apkPath = 'temp.apk';
  try {
    await fs.writeFile(apkPath, apkBuffer);
    await execPromise(`java -jar tools/apktool_2.12.0.jar d ${apkPath} -f -o decoded_apk`);
    const files = await fs.readdir('decoded_apk', { recursive: true });
    const fileList = files.filter(f => f.match(/\.(xml|smali|json|yml)$/));
    const fileContents = {};
    for (const file of fileList) {
      fileContents[file] = await fs.readFile(`decoded_apk/${file}`, 'utf8');
    }
    res.json({ files: fileContents, fileList });
    // Usuń tymczasowe pliki
    await fs.rm(apkPath);
    await fs.rm('decoded_apk', { recursive: true });
  } catch (err) {
    res.status(500).json({ error: `Błąd dekodowania APK: ${err.message}` });
  }
});

app.get("/", (req, res) => res.send("OK"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend działa na porcie ${PORT}!`));
