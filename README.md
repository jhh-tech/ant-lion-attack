# 🐜🕳️ Ant Lion Attack

Ett litet 2D-arkadspel där du är ett **myrlejon** nedgrävt i botten av en sandgrop. Myror vandrar längs kanten — knuffa ner dem, kasta sand på dem så de glider mot botten, och ät dem för att överleva och växa dig större!

**▶️ Spela här:** https://jhh-tech.github.io/ant-lion-attack/

![Myrlejonet vandrar in och gräver sin grop](assets/gameplay.gif)

Fungerar i webbläsaren på både dator och mobil (mus eller touch). Går att lägga till på hemskärmen som en app.

![Skärmdump från spelet](assets/screenshot.png)

## Hur man spelar

- **Myror** kryper fram ur bona vid skärmkanterna och vandrar mot gropen. Tryck/klicka nära gropens kant för att knuffa in en myra, och tryck på myror som redan fallit ner för att kasta sand på dem så de glider mot botten – där de fångas.
- **Energin** sjunker hela tiden. Fånga myror för att fylla på den. Tar energin slut är det game over.
- **Väx dig större** genom att samla poäng. Myrlejonet växer i sex steg (Larv → … → Jättemyrlejon), och gropen växer med i både bredd och djup. Större myrlejon kan äta större byten.
- **⚡ Kraftmätaren** fylls var 350:e poäng. När den är laddad – tryck på den för att skaka hela gropen och dra ner alla myror på en gång.
- **⚠ Stekeln** (gul med ränder) flyger in från sidan. Får den ner till botten sticker den dig – **undvik att trycka ner den!**
- **🌧 Regn:** ett moln seglar in och sedan regnar det en stund. Då blir sanden hård och myrorna ramlar inte ner förrän den torkat.

I inställningarna kan du justera antal myror på banan och deras storlek.

## Köra lokalt

Spelet är helt statiskt – ingen byggprocess, inga beroenden. Öppna bara `index.html` i en webbläsare, eller servera mappen med valfri statisk webbserver, t.ex.:

```bash
python -m http.server 8000
# öppna sedan http://localhost:8000/
```

## Teknik

- Ren HTML + CSS + JavaScript, allt i en enda `index.html`.
- Rendering med Canvas 2D, ljud med Web Audio API (genereras i kod – inga ljudfiler).
- PWA-manifest (`manifest.webmanifest`) och ikoner för installation på hemskärmen.
- Poäng och inställningar sparas lokalt i webbläsaren (localStorage).

## Deploy

Alla filer är statiska, så det räcker att lägga `index.html`, `manifest.webmanifest` och `icons/` i en katalog på valfri webbserver (helst över HTTPS). Det här repot publiceras automatiskt via GitHub Pages från `main`-branchen.
