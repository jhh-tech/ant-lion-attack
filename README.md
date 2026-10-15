# 🐜🕳️ Ant Lion Attack

Ett litet 2D-arkadspel där du är ett **myrlejon** nedgrävt i botten av en sandgrop. Myror vandrar längs kanten — knuffa ner dem, kasta sand på dem så de glider mot botten, och ät dem för att överleva och växa dig större!

**▶️ Spela här:** https://jhh-tech.github.io/ant-lion-attack/

![Myrlejonet vandrar in och gräver sin grop](assets/gameplay.gif)

Fungerar i webbläsaren på både dator och mobil (mus eller touch). Går att lägga till på hemskärmen som en app.

![Skärmdump från spelet](assets/screenshot.png)

## 🆕 Ant Lion Attack 3D

En ny 3D-version i isometrisk vy (à la Diablo) finns i mappen [`3d/`](3d/).

**▶️ Spela här:** https://jhh-tech.github.io/ant-lion-attack/3d/

Här går du själv omkring som myrlejonet på en stor sandslätt:

- **Gå** genom att klicka/trycka på marken (håll in för att fortsätta gå) eller med `WASD`/piltangenterna.
- **Hugg** genom att klicka på ett kryp, högerklicka eller trycka `F`.
- **Gräv ner dig** med `Space`. Du gömmer dig för fiender och en grop växer fram runt dig. Myror och fiender som hamnar i gropen glider ner i dina käkar.
- **Bakhåll:** hugg nedifrån sanden eller kliv upp bredvid en fiende för dubbel eller trippel skada.
- **Sandskalv** (`Q`) när kraftmätaren är full.
- **Fiender** från lätta till svåra: soldatmyror, pansrade skalbaggar, hoppande vargspindlar, störtdykande steklar, fåglar (gräv ner dig när skuggan kommer!) och bönsyrsan som boss.
- **Kraftföremål:** honung, sockerbit, snabbfot, stålkäkar, djupgrop, pansar och feromon.
- Du växer i sex stadier, och nivån stiger var 45:e sekund.

3D-versionen använder [three.js](https://threejs.org/) (en lokal kopia ligger i `3d/vendor/`, MIT-licens). Alla modeller och ljud genereras i kod. Eftersom den använder ES-moduler måste den serveras över HTTP (t.ex. `python -m http.server`) och kan inte öppnas direkt som fil.

## Hur man spelar (2D)

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
