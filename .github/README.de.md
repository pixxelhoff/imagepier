<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../web/static/imagepier/logo-stacked-dark.svg">
    <img src="../web/static/imagepier/logo-stacked-light.svg" alt="ImagePier" width="260">
  </picture>
</p>

<h3 align="center">Die selbst gehostete Mediendatenbank für Teams – auf Basis von Immich</h3>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-3F51B5?style=for-the-badge" alt="Lizenz: AGPL v3"></a>
  <a href="https://github.com/immich-app/immich"><img src="https://img.shields.io/badge/based_on-Immich_v3.4.2-4250af?style=for-the-badge" alt="Basiert auf Immich v3.4.2"></a>
  <img src="https://img.shields.io/badge/status-in_development-e0a100?style=for-the-badge" alt="Status: in Entwicklung">
  <a href="https://github.com/pixxelhoff/imagepier/pkgs/container/imagepier-server"><img src="https://img.shields.io/badge/image-ghcr.io-a66cff?style=for-the-badge" alt="Container-Image auf ghcr.io"></a>
</p>

<p align="center"><a href="README.md">English</a> · <b>Deutsch</b></p>

<p align="center">
  <a href="#funktionen">Funktionen</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#releases-und-versionen">Releases</a> ·
  <a href="#entwicklung">Entwicklung</a> ·
  <a href="#über-imagepier">Über ImagePier</a>
</p>

---

> [!WARNING]
> **ImagePier wird noch aktiv entwickelt und ist noch nicht für den Produktivbetrieb empfohlen.**
> Funktionen, Berechtigungen und Datenstrukturen können sich zwischen Releases noch ändern, und Updates können
> manuelle Schritte erfordern. Probiere ImagePier mit Beispielfotos auf einer Testinstallation aus und sichere
> Datenbank und Bibliothek.

ImagePier behält alles, was [Immich](https://github.com/immich-app/immich) ausmacht – schnelle Uploads, Zeitleiste,
Alben, Gesichter- und Objektsuche, Mobil-Apps – und ergänzt, was Teams für die professionelle Arbeit mit Fotos
brauchen:

- 📝 **Nutzungsrechte, Lizenzen und Bildnachweise** für jedes Bild – auch in heruntergeladene Dateien geschrieben
- ✅ **Ein Freigabestatus** (in Prüfung, freigegeben, freigegeben mit Einschränkung, gesperrt), über den
  Medienverantwortliche entscheiden
- 🗂️ **Eine gemeinsame Mediendatenbank** mit Rollen, Bereichen (Abteilungen) und eigenem Papierkorb
- 🏷️ **Eine verbindliche Schlagwortliste** für einheitliches Verschlagworten und Suchen
- 🌐 **Öffentliche Website-Galerien**, die nur zur Veröffentlichung freigegebene Bilder zeigen
- 📋 **Ein Audit-Log** über Uploads, Downloads und Änderungen

> [!NOTE]
> ImagePier ist ein unabhängiger Fork und **steht in keiner Verbindung zum Immich-Team und wird von ihm nicht
> unterstützt**. Fehler, die nur in ImagePier auftreten, bitte hier melden, nicht im Immich-Repository.

## Funktionen

### 📝 Nutzungsrechte für jedes Bild

- **Nutzungsrechte-Panel** in der Info-Seitenleiste der Bildansicht: Fotograf, Rechteinhaber, Bildnachweis,
  Lizenzart, Lizenzquelle, erlaubte Nutzung (intern, Website, Print, Social Media, Presse), Ablaufdatum und Notizen.
- **Titel und Alternativtext** – werden auch in heruntergeladene Dateien (XMP/IPTC) geschrieben und in
  Website-Galerien verwendet.
- **Rechte-Umfang** – Gebiet, Bearbeitung (erlaubt, nur Zuschnitt, nicht erlaubt), Weitergabe an Dritte,
  Exklusivität sowie Zusatzprüfungen (erkennbare Personen, Minderjährige, Musik/Kunstwerke/Marken, Drohne,
  Privatgelände), jeweils *betrifft nicht*, *offen* oder *geklärt*; offene Prüfungen werden hervorgehoben. Dazu ein
  Link zum Rechtedokument.
- **Kanäle** – für jeden Kanal (intern, Website, Print, Social Media, Presse, Social Ads, Präsentationen, Partner,
  bezahlte Kampagnen) *erlaubt*, *nicht erlaubt* oder *bedingt*, mit einem Hinweis auf die Bedingungen.
  Administrator/innen passen die Kanalliste unter *Administration → Kanäle* an.
- **Freigabestatus** – *In Prüfung*, *Freigegeben*, *Freigegeben mit Einschränkung* (mit Hinweis auf die
  Einschränkung) oder *Gesperrt*; *Abgelaufen* erscheint automatisch nach dem Ablaufdatum. Über den Status
  entscheiden die Medienverantwortlichen des Bereichs; Änderungen durch Bearbeiter setzen freigegebene Bilder zurück
  auf *In Prüfung*, gesperrte Bilder bleiben gesperrt.
- **Gesperrte Bilder** können nicht heruntergeladen werden (außer von Medienverantwortlichen und Administratoren),
  werden für neue geteilte Links abgelehnt, sind in bestehenden geteilten Links ausgeblendet und erscheinen nie in
  Website-Galerien.
- **Automatische Vorschläge** nach dem Upload aus eingebetteten IPTC/XMP/EXIF-Metadaten (By-line, Creator, Artist,
  Copyright Notice, Rights, Copyright, Credit) und aus Dateinamen wie `Hafenfest (c) ACME, Jane Doe.jpg`.
  Vorschläge sind zur Prüfung markiert und überschreiben nie vorhandene Angaben.
- **Mehrfachbearbeitung** vieler Bilder auf einmal – in einem Bereich, unter *Alle Fotos* oder in Suchergebnissen.
  Nur ausgefüllte Felder werden übernommen, alles andere bleibt, wie es ist.
- **Bildnachweis kopieren** mit einem Klick, bereit zum Einfügen unter einem Foto auf einer Website oder im Druck.
- **Nachweise in heruntergeladenen Dateien** – beim Herunterladen (Einzeldatei, ZIP-Archiv, geteilter Link, Galerie
  oder Mobil-App) werden Fotograf, Copyright, Bildnachweis und Nutzungsbedingungen in die IPTC/XMP/EXIF-Metadaten der
  Datei geschrieben. Das Original in der Bibliothek bleibt unverändert; unterstützte Formate: JPEG, PNG, TIFF, WebP,
  HEIC.

### 🔎 Suche und Lizenzüberwachung

- **Reiter „Nutzungsrechte“ im Suchdialog** – Filter nach Fotograf, Rechteinhaber, Lizenzart, Status (freigegeben,
  freigegeben mit Einschränkung, läuft bald ab, abgelaufen, gesperrt, in Prüfung), erlaubter Nutzung, Lizenzquelle,
  Bildnachweis, Ablaufjahr und Bereich, kombinierbar mit allen anderen Immich-Filtern.
- **Fehlende Angaben finden** – jedes Bild ohne Rechteinhaber, Fotograf oder Lizenz wird markiert
  (`Nutzungsrechte/Fehlende Angaben/…`), damit unvollständige Bilder gefunden und ergänzt werden können.
- **Tägliche Lizenzprüfung** – Lizenzen, die innerhalb von 30 Tagen ablaufen, und abgelaufene Lizenzen werden
  markiert, und die Besitzer der Bilder erhalten eine Benachrichtigung in der App.
- Funktioniert auch in den **offiziellen Immich-Mobil-Apps**: Nutzungsrechte werden als Immich-Tags gespiegelt
  (z. B. `Nutzungsrechte/Status/Abgelaufen`) und lassen sich mit dem normalen Tag-Filter finden.

### 🗂️ Rollen und gemeinsame Mediendatenbank

- **Bereiche (Abteilungen) mit eigenen Konten** – die offiziellen Medien gehören technischen Konten, einem pro
  Bereich. Jeder Bereich ist nur für die Personen freigegeben, die dort eine Stufe haben; Zeitleiste, Suche, Karte und
  Mobil-Apps zeigen also nur die Bereiche, auf die jemand Zugriff hat. Unter *Fotos* in der Seitenleiste wechselt
  jeder zwischen *Eigene Fotos*, *Alle Fotos* (eigene Fotos und alle zugänglichen Bereiche) und einem Eintrag pro
  Bereich.
- **Rollen pro Konto** (*Administration → Benutzer → Benutzer → Rolle und Rechte*): *Administrator* (alles),
  *Mitarbeiter/in* und *Extern*. Zugriff auf die Mediendatenbank gibt es **pro Bereich** mit einer Stufe:

  | Stufe | Darf im Bereich |
  |---|---|
  | **Nur ansehen** | ansehen, zu eigenen Alben hinzufügen |
  | **Standard** | + herunterladen |
  | **Bearbeiter** | + hochladen, Nutzungsrechte pflegen, in den Papierkorb verschieben und wiederherstellen, Links und Galerien teilen |
  | **Medienverantwortlich** | + Freigabestatus festlegen, endgültig löschen (nur Mitarbeiter/innen; jeder Bereich sollte mindestens eine Person haben) |

  Ohne Stufe ist der Bereich nicht zugänglich. Eigene Fotos sind nicht eingeschränkt – jeder kann sie hochladen,
  teilen und löschen. **Die vollständige Berechtigungsmatrix** (Externe, Papierkorb, Teilen, Galerien) steht in
  [PERMISSIONS.de.md](../PERMISSIONS.de.md). **Alles, was sich anders als in Immich verhält**, steht in
  [DIFFERENCES.md](../DIFFERENCES.md) (auf Englisch).
- **Benutzerliste mit Rollen** – *Administration → Benutzer* zeigt die Rolle jedes Kontos und lässt sich durchsuchen,
  nach Rolle filtern und nach Name, E-Mail oder Rolle sortieren.
- **Bereiche verwalten** – Administratoren legen Bereiche unter *Administration → Bereiche* an, benennen sie um und
  entfernen sie; Bereiche ohne Medienverantwortliche werden markiert, und Bereiche mit Bildern können nicht entfernt
  werden. Jedes Bild der Mediendatenbank zeigt seinen Bereich, und die Nutzungsrechte-Suche funktioniert pro Bereich.
- **Einem Bereich zuweisen** – eigene Bilder können ab der Stufe *Bearbeiter* einem Bereich zugewiesen werden
  (Auswahlmenü oder Menü eines einzelnen Fotos); Bearbeiter können auch direkt in der Ansicht eines Bereichs
  hochladen.
- **Nutzungsrechte freigeben** – von Bearbeitern eingetragene Nutzungsrechte bleiben *In Prüfung*, bis
  Medienverantwortliche des Bereichs (oder ein Administrator) über den Freigabestatus entscheiden. Nur freigegebene
  Nutzungsrechte zählen für Website-Galerien.
- **Personen über Bereiche hinweg** – die Mediendatenbank und alle Bereiche teilen sich eine Gesichtserkennung: Eine
  Person wird in jedem Bereich erkannt, ein einmal vergebener Name gilt überall, und die Personen-Übersicht zeigt die
  Personen aller zugänglichen Bereiche.
- **Karte über Bereiche hinweg** – die Karte zeigt die Aufnahmeorte der eigenen Fotos und aller zugänglichen
  Bereiche.
- **Externe Fotografen** – Externe mit der Stufe *Bearbeiter* liefern Fotos in einen Bereich und pflegen die
  Nutzungsrechte ihrer eigenen Lieferungen; sie können keine anderen Fotos verschieben, keine Links teilen und keine
  Galerien veröffentlichen.
- **Papierkorb pro Bereich** – Bearbeiter und Medienverantwortliche finden den Papierkorb ihrer Bereiche unter den
  Bereichen in der Seitenleiste, filterbar nach Bereich; Bearbeiter stellen wieder her, Medienverantwortliche löschen
  endgültig. Administratoren sehen den Papierkorb aller Bereiche unter *Administration → Papierkorb*.
- **Teilen** – geteilte Links und Website-Galerien enthalten nur Fotos aus Bereichen, in denen die teilende Person
  mindestens *Bearbeiter* ist.

### 🏷️ Schlagwortliste

- **Eine Schlagwortliste für alle** – Administratoren fügen die Schlagwortliste (Kategorie, Schlagwort,
  Beschreibung) aus einer Tabelle unter *Administration → Schlagworte* ein oder legen dort einzelne Schlagworte an und
  bearbeiten sie. Ein umbenanntes Schlagwort wird an allen Fotos umbenannt; ungenutzte Schlagworte lassen sich
  löschen, genutzte deaktivieren. Die Liste lässt sich als CSV-Datei für Excel herunterladen.
- **Schlagworte zuweisen** – im Panel *Schlagworte* eines Fotos oder für eine Auswahl (in einem Bereich, unter
  *Alle Fotos* oder in Suchergebnissen), gruppiert nach Kategorie. Schlagworte werden als Immich-Tags
  `Kategorie/Schlagwort` des Kontos gespeichert, dem das Foto gehört; sie funktionieren damit auch für Fotos der
  Bereiche und werden wie Immich-Tags in die XMP-Begleitdatei geschrieben.
- **Schlagwortsuche** – der Suchreiter *Schlagworte* findet Fotos mit allen gewählten Schlagworten in den eigenen
  Fotos und allen zugänglichen Bereichen gleichzeitig.
- Sobald eine Schlagwortliste existiert, legen nur Administratoren neue Tags an, damit das Vokabular einheitlich
  bleibt. Die Tag-Funktion von Immich ist Administratoren vorbehalten; alle anderen arbeiten mit der Schlagwortliste.
- Beim Verschieben in einen Bereich bleiben die Tags eines Fotos erhalten.

### 🌐 Website-Galerien

Administratoren, Bearbeiter und Medienverantwortliche (nur Mitarbeiter/innen, keine Externen) veröffentlichen Alben als
öffentliche Galerien unter *Website-Galerien* in der Seitenleiste – alle außer Administratoren nur ihre eigenen Alben.
Jede Galerie erhält einen zufälligen Link (`/gallery/<key>`), der von einer Website verlinkt oder in einem iframe
eingebettet werden kann – Besucher brauchen keine Anmeldung.

- Es erscheinen nur Bilder mit **freigegebenen Nutzungsrechten für Website oder Presse**, die **nicht abgelaufen**
  sind. Der Filter läuft auf dem Server, der Rest des Albums bleibt privat.
- Jedes Bild zeigt seinen Bildnachweis. Besucher bestätigen die Lizenzbedingungen vor dem Herunterladen – einzelne
  Bilder, eine Auswahl oder die ganze Galerie als ZIP-Datei.
- **Eigenes Aussehen** – Administratoren legen eine Standard-Überschrift, Akzentfarbe, Logo, Fußzeile und Links zu
  Impressum und Datenschutzerklärung fest. Jede Galerie kann einzelne Werte überschreiben.
- Downloads lassen sich pro Galerie abschalten und werden im Audit-Log gezählt (ohne personenbezogene Daten der
  Besucher).

### 📋 Audit-Log

Unter *Administration → Audit-Log* sehen Administratoren Uploads, Downloads, Änderungen an Nutzungsrechten,
Verschiebungen in die Mediendatenbank, Papierkorb, Wiederherstellen und endgültiges Löschen, Rollen- und
Bereichsänderungen, veröffentlichte Galerien sowie angelegte oder gelöschte Konten – filterbar nach Aktion, Person und
Zeitraum, mit CSV-Export.

- **Aufbewahrung** – standardmäßig 365 Tage, einstellbar; ältere Einträge werden jede Nacht entfernt.
- **Downloads** – standardmäßig nur gezählt. Das Speichern, wer heruntergeladen hat, lässt sich einschalten; das
  erfasst Verhalten von Beschäftigten, also vorher mit Betriebsrat und Datenschutzbeauftragten abstimmen.
- **Anmeldungen** – optional, standardmäßig aus.

### 🎨 Eigenes Aussehen

- **Name und Logo ImagePier** in der Web-App, im Browser-Tab und in der installierten Web-App (PWA). Immich wird
  weiterhin im Dialog „Über“ genannt.
- **Eigenes Logo** ohne Neubau: einen Ordner mit den Logo-Dateien einbinden (siehe [Eigenes Logo](#eigenes-logo)).
- **E-Mails im ImagePier-Design** – Willkommens-, Test- und Album-E-Mails zeigen das ImagePier-Logo (oder das eigene
  Logo aus dem Logo-Ordner), eine Akzentfarbe und eine neutrale Fußzeile statt der von Immich, auf Deutsch oder
  Englisch. Name, Farbe und Logo lassen sich in der `.env` ändern.

### 🧭 Geplant

- **Import-Schnittstelle und Import-Tool** – Upload mit Bereich, Schlagworten und Nutzungsrechten in einem Schritt.

### 🧭 Vielleicht später

- **Single Sign-on** über OpenID Connect (z. B. Keycloak vor LDAP) mit Rollen aus Gruppen.
- **Registrierung vor Downloads** in Galerien (Name, Organisation, Verwendungszweck), gespeichert im Audit-Log.
- **E-Mail-Vorlagen in der Administration** – Logo, Farben, Texte und Betreffzeilen pro E-Mail-Art, mit Vorschau.

## Installation

ImagePier ersetzt nur den **Server**-Container von Immich. Maschinelles Lernen, PostgreSQL und Redis nutzen weiter die
offiziellen Immich-Images, und vorhandene Immich-Daten werden so verwendet, wie sie sind.

> [!IMPORTANT]
> Verwende ein ImagePier-Release, das zu deiner aktuellen Immich-Version passt (z. B. `v3.4.2-ip.50` für Immich
> `v3.4.2`). Ein Downgrade von Immich wird nicht unterstützt. Lege vor dem Wechsel immer eine Datenbanksicherung an.

1. Ausgangspunkt ist eine funktionierende
   [Immich-Installation mit Docker Compose](https://docs.immich.app/install/docker-compose).
2. In der `.env` die Immich-Version festlegen und ein ImagePier-Release wählen:

   ```bash
   IMMICH_VERSION=v3.4.2
   IMAGEPIER_VERSION=v3.4.2-ip.50
   IMAGEPIER_LANGUAGE=de   # Sprache der Nutzungsrechte-Tags und Benachrichtigungen: en, de
   # optional: E-Mail und Name des Kontos der Mediendatenbank (wird beim ersten Start angelegt)
   # IMAGEPIER_LIBRARY_EMAIL=media-library@imagepier.local
   # IMAGEPIER_LIBRARY_NAME=Mediendatenbank
   # optional: Aussehen der E-Mails (Standard: eingebettetes ImagePier-Logo; eigenes Logo als https-URL einer PNG, kein SVG)
   # IMAGEPIER_MAIL_NAME=ImagePier
   # IMAGEPIER_MAIL_COLOR=#6b46e5
   # IMAGEPIER_MAIL_LOGO_URL=https://photos.example.com/mail-logo.png
   ```

3. [`imagepier/deploy/docker-compose.override.yml`](../imagepier/deploy/docker-compose.override.yml) neben die
   `docker-compose.yml` kopieren. Docker Compose liest sie automatisch ein.
4. Neu starten:

   ```bash
   docker compose pull && docker compose up -d
   ```

Der Dialog „Über“ in der Web-App zeigt jetzt `pixxelhoff/imagepier` als Repository.

Um Nutzungsrechte-Vorschläge für Bilder zu bekommen, die vor dem Wechsel hochgeladen wurden, den Job
*Administration → Jobs → Metadaten extrahieren → Alle* starten oder bei einzelnen Bildern *Metadaten aktualisieren*
verwenden.

### Eigenes Logo

Die Logo-Dateien werden unter `/imagepier/` der Web-App ausgeliefert. Für ein eigenes Logo einen Ordner mit diesen
Dateien anlegen und in der `docker-compose.override.yml` einbinden (siehe das auskommentierte Beispiel dort):

| Datei | Verwendet für |
|---|---|
| `logo-icon.svg` | Bildmarke (eingeklappte Seitenleiste, geteilte Links, Einrichtung) |
| `logo-inline-light.svg` / `logo-inline-dark.svg` | Wortmarke in der oberen Leiste (helles / dunkles Design) |
| `logo-stacked-light.svg` / `logo-stacked-dark.svg` | Bildmarke über Wortmarke auf der Anmeldeseite |

Am besten von den [Standarddateien](../web/static/imagepier/) ausgehen und die Proportionen beibehalten (die
Inline-Logos werden mit fester Höhe angezeigt). Browser-Symbol (Favicon) und App-Symbole bleiben die von ImagePier.

### Automatische Container-Updates

Wer Werkzeuge wie Watchtower nutzt, sollte den Server- und den Machine-Learning-Container ausnehmen – sie müssen
zusammen mit einem passenden ImagePier-Release aktualisiert werden. Die Override-Datei setzt das
Watchtower-Ausschluss-Label bereits für beide.

### Zurück zu Immich

ImagePier ändert keine Datenbanktabellen von Immich. `docker-compose.override.yml` entfernen und neu starten, um zum
offiziellen Immich-Server derselben Version zurückzukehren. Nutzungsrechte bleiben in den Asset-Metadaten von Immich
gespeichert, und die `Nutzungsrechte/…`-Tags und Schlagworte bleiben als normale Tags erhalten. Fotos der Bereiche
bleiben in den Bereichskonten – siehe [DIFFERENCES.md](../DIFFERENCES.md#switching-back-to-immich).

## Releases und Versionen

| Tag | Bedeutung |
|---|---|
| `v3.4.2-ip.50` | ImagePier-Release 50 auf Basis von Immich `v3.4.2` |
| `release` | neuestes ImagePier-Release |
| `edge` | neuester Build des Branches `imagepier` – nur zum Testen |

Images: `ghcr.io/pixxelhoff/imagepier-server`

## Entwicklung

Siehe [IMAGEPIER.md](../IMAGEPIER.md) (auf Englisch) zum Aufbau des Repositorys, dazu, wie ImagePier mit neuen
Immich-Releases aktualisierbar bleibt, zu den CI-Workflows und zu den Code-Konventionen.

## Über ImagePier

ImagePier wird von **[pixxelhoff](https://github.com/pixxelhoff)** entwickelt und gepflegt.
Fragen, Ideen oder Feedback: [contact@pixxelhoff.com](mailto:contact@pixxelhoff.com)

> [!TIP]
> **Mit Vibe Coding entstanden.** ImagePier wurde gebaut, indem Funktionen in Alltagssprache beschrieben und mit
> KI-gestützter Entwicklung umgesetzt wurden. Jede Änderung läuft in der CI durch die komplette Testsuite von Immich
> und wird im Alltag getestet, bevor sie veröffentlicht wird – trotzdem bitte wie jede andere Software prüfen, bevor
> man sich darauf verlässt.

## Lizenz

ImagePier steht wie Immich unter der [GNU Affero General Public License v3.0](../LICENSE).
Der vollständige Quellcode jeder veröffentlichten Version ist in diesem Repository verfügbar.

Immich ist eine Marke der jeweiligen Inhaber. ImagePier ist ein unabhängiges Projekt auf Basis des Open-Source-Codes
von Immich.
