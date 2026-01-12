# Utrustningsplacering - Användarguide för Tekniker

**BeGone Skadedjur & Sanering AB**
*Version 1.0 | Januari 2026*

---

## Innehåll

1. [Introduktion](#introduktion)
2. [Komma igång](#komma-igång)
3. [Navigera till Utrustningsplacering](#navigera-till-utrustningsplacering)
4. [Välja kund](#välja-kund)
5. [Registrera ny utrustning](#registrera-ny-utrustning)
6. [Kartvy och listvy](#kartvy-och-listvy)
7. [Redigera och ta bort utrustning](#redigera-och-ta-bort-utrustning)
8. [Statushantering](#statushantering)
9. [Exportera till PDF](#exportera-till-pdf)
10. [Vanliga frågor](#vanliga-frågor)
11. [Felsökning](#felsökning)

---

## Introduktion

Utrustningsplacering är ett verktyg som låter dig som tekniker registrera och hantera all skadedjursbekämpningsutrustning som placeras hos våra kontraktskunder. Systemet använder GPS-koordinater från din mobiltelefon för att exakt dokumentera var varje fälla eller station är placerad.

### Fördelar med systemet

- **Exakt dokumentation** - GPS-koordinater säkerställer att varje placering är dokumenterad
- **Spårbarhet** - Se vem som placerat utrustningen och när
- **Kundinsyn** - Kunder kan se sin utrustning i kundportalen
- **Effektiv uppföljning** - Hitta enkelt tillbaka till utrustning vid servicebesök
- **Professionella rapporter** - Exportera PDF-rapporter för kunder

### Utrustningstyper som hanteras

| Typ | Färgkod | Serienummer |
|-----|---------|-------------|
| **Mekanisk fälla** | Grön | Obligatoriskt |
| **Betongstation** | Grå | Valfritt |
| **Betesstation** | Svart | Valfritt |

---

## Komma igång

### Förutsättningar

Innan du börjar använda Utrustningsplacering, se till att:

1. **Du är inloggad** i teknikerportalen
2. **Platsbehörighet är aktiverad** i din webbläsare/app
3. **GPS är påslagen** på din mobiltelefon
4. Du har tillgång till en **kontraktskund** att registrera utrustning för

### Rekommenderad utrustning

- Smartphone med GPS (Android eller iPhone)
- Stabil internetanslutning (4G/5G eller WiFi)
- Uppdaterad webbläsare (Chrome, Safari eller Firefox)

---

## Navigera till Utrustningsplacering

### Från Dashboard

1. Logga in i teknikerportalen
2. På din **Dashboard** hittar du sektionen **Snabbåtgärder**
3. Klicka på knappen **"Utrustning"** (grön knapp med kartnålsikon)

![Snabbåtgärd](./images/dashboard-equipment-button.png)

### Via menyn

Du kan även navigera direkt via URL:
```
/technician/equipment
```

---

## Välja kund

När du öppnar Utrustningsplacering visas först en kundväljare.

### Steg för steg

1. **Klicka på dropdown-menyn** märkt "Välj kund"
2. **Sök eller bläddra** bland dina kontraktskunder
3. **Välj kunden** du ska arbeta med

> **Tips:** Endast kunder med aktiva kontrakt visas i listan. Om en kund saknas, kontakta koordinatorn.

### Efter kundval

När du valt en kund laddas automatiskt:
- All befintlig utrustning för kunden
- Statistik över antal enheter per typ
- Karta centrerad på kundens placeringar (om det finns några)

---

## Registrera ny utrustning

### Öppna formuläret

Klicka på den gröna knappen **"+ Ny placering"** i verktygsfältet.

### Fyll i uppgifter

#### 1. Utrustningstyp (obligatoriskt)

Välj typ av utrustning:
- **Mekanisk fälla** - Traditionella slagfällor
- **Betongstation** - Fasta betongstationer
- **Betesstation** - Betesstationer för gnagare

#### 2. Serienummer

- **Obligatoriskt** för mekaniska fällor
- **Valfritt** för övriga typer
- Ange det exakta serienumret från utrustningen

#### 3. GPS-position (obligatoriskt)

**Automatisk positionshämtning:**
1. Klicka på knappen **"Hämta GPS-position"**
2. Tillåt platsbehörighet om webbläsaren frågar
3. Vänta medan positionen hämtas (kan ta några sekunder)
4. När positionen är hämtad visas koordinaterna

**Manuell inmatning:**
Om GPS inte fungerar kan du ange koordinater manuellt:
- Latitude (t.ex. 59.329323)
- Longitude (t.ex. 18.068580)

> **Precision:** Systemet visar GPS-noggrannheten (t.ex. ±5m). För bästa resultat, vänta tills noggrannheten är under 10 meter.

#### 4. Kommentar (valfritt)

Lägg till relevant information, t.ex.:
- "Placerad bakom kylskåpet"
- "Utomhus vid norra hörnet"
- "Kunden har nyckeln till utrymmet"

#### 5. Foto (valfritt)

Dokumentera placeringen med foto:
1. Klicka på **"Lägg till foto"**
2. Välj att ta nytt foto eller ladda upp befintligt
3. Fotot sparas tillsammans med placeringen

### Spara placeringen

1. Kontrollera att alla obligatoriska fält är ifyllda
2. Klicka på **"Spara placering"**
3. Utrustningen visas nu på kartan och i listan

---

## Kartvy och listvy

Systemet erbjuder två olika sätt att visa utrustning.

### Kartvy

Kartvyn visar alla placeringar på en interaktiv OpenStreetMap-karta.

**Funktioner:**
- **Färgkodade markörer** - Varje utrustningstyp har sin egen färg
- **Klicka på markör** - Visar detaljer om placeringen
- **Zooma in/ut** - Använd +/- eller fingergester
- **Centrera på min position** - Klicka på navigeringsikonen

**Markörsymboler:**
- Solid cirkel = Aktiv utrustning
- Cirkel med "?" = Försvunnen
- Cirkel med "✕" = Borttagen

### Listvy

Listvyn visar utrustningen i ett tabellformat.

**Kolumner:**
- Typ (med färgindikator)
- Serienummer
- Status
- Placerad datum
- Tekniker

**Filtrering:**
- Filtrera på utrustningstyp
- Filtrera på status
- Sök på serienummer

**Byta vy:**
Använd knapparna **"Lista"** och **"Karta"** i verktygsfältet.

---

## Redigera och ta bort utrustning

### Redigera placering

1. **I kartvyn:** Klicka på markören, sedan "Redigera" i popup-fönstret
2. **I listvyn:** Klicka på pennikonen på raden
3. Uppdatera önskade fält
4. Klicka **"Spara ändringar"**

### Ta bort placering

> **Varning:** Borttagning kan inte ångras. Överväg att ändra status till "Borttagen" istället.

1. **I kartvyn:** Klicka på markören, sedan "Ta bort"
2. **I listvyn:** Klicka på papperskorgsikonen
3. Bekräfta borttagningen i dialogrutan

---

## Statushantering

Varje utrustning har en status som spårar dess tillstånd.

### Tillgängliga statusar

| Status | Beskrivning | När använda |
|--------|-------------|-------------|
| **Aktiv** | Utrustningen är på plats och fungerar | Standard vid ny placering |
| **Borttagen** | Utrustningen har plockats bort | Vid avslutad behandling eller kundönskemål |
| **Försvunnen** | Utrustningen kunde inte hittas | Vid servicebesök där utrustningen saknas |

### Ändra status

1. Öppna utrustningens detaljer
2. Klicka på nuvarande status
3. Välj ny status i dropdown-menyn
4. Statusändringen loggas automatiskt med datum och tekniker

---

## Exportera till PDF

Du kan generera professionella PDF-rapporter för kunder.

### Skapa PDF-rapport

1. Se till att rätt kund är vald
2. Klicka på **"PDF"**-knappen i verktygsfältet
3. PDF:en genereras och laddas ner automatiskt

### Rapportens innehåll

- **BeGone-header** med företagslogotyp
- **Sammanfattning** med antal per utrustningstyp
- **Detaljerad lista** med:
  - Typ och serienummer
  - GPS-koordinater
  - Status
  - Placeringsdatum
- **Kommentarer** för placeringar med anteckningar
- **Professionell footer** med kontaktuppgifter

### Filnamn

PDF:en sparas med formatet:
```
Utrustningsplacering_[Kundnamn]_[Datum].pdf
```

---

## Vanliga frågor

### Varför kan jag inte se alla kunder i listan?

Endast kunder med aktiva kontrakt visas. Kontakta koordinatorn om en kund saknas.

### GPS-positionen är fel, vad gör jag?

1. Vänta några sekunder och försök igen
2. Gå utomhus för bättre GPS-signal
3. Kontrollera att platsbehörighet är aktiverad
4. Som sista utväg, ange koordinater manuellt

### Kan kunden se all utrustning?

Ja, kunden ser sin utrustning i kundportalen men kan inte redigera något.

### Vad händer om jag tar bort utrustning av misstag?

Kontakta administratör - borttagningar loggas och kan eventuellt återställas.

### Kan jag registrera utrustning utan internetanslutning?

Nej, systemet kräver internetanslutning. Anteckna uppgifterna och registrera när du har anslutning.

---

## Felsökning

### "Åtkomst till plats nekad"

**Orsak:** Webbläsaren har inte behörighet att använda GPS.

**Lösning:**
1. Öppna webbläsarens inställningar
2. Sök efter "Platsinställningar" eller "Location"
3. Tillåt platsåtkomst för BeGone-portalen
4. Ladda om sidan och försök igen

### "Platsinformation ej tillgänglig"

**Orsak:** GPS-signalen är för svag.

**Lösning:**
- Gå närmare ett fönster eller utomhus
- Vänta 10-15 sekunder
- Starta om webbläsaren

### "Timeout vid hämtning av plats"

**Orsak:** Det tog för lång tid att få GPS-position.

**Lösning:**
- Kontrollera att GPS är aktiverat på enheten
- Försök på en plats med bättre mottagning
- Ange koordinater manuellt om problemet kvarstår

### Kartan visas inte

**Orsak:** Problem med kartladdning.

**Lösning:**
1. Kontrollera internetanslutningen
2. Rensa webbläsarens cache
3. Prova en annan webbläsare
4. Kontakta IT-support om problemet kvarstår

### Serienummer validering misslyckas

**Orsak:** För mekaniska fällor krävs serienummer.

**Lösning:**
- Kontrollera att serienumret är korrekt inmatat
- Serienummer måste vara unikt
- Kontakta administratör om serienumret redan är registrerat

---

## Support

Vid tekniska problem eller frågor, kontakta:

**BeGone IT-Support**
E-post: support@begone.se
Telefon: 010 280 44 10

**Arbetstider:**
Måndag-fredag: 08:00-17:00

---

*Dokumentet uppdaterades senast: Januari 2026*
*BeGone Skadedjur & Sanering AB - Org.nr: 559378-9208*
