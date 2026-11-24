# ImagePier – Rollen und Rechte

[English](PERMISSIONS.md) · **Deutsch**

Diese Seite erklärt, wer in ImagePier was darf. Die Kurzfassung steht in der [README](.github/README.de.md).

## Begriffe

- **Eigene Fotos** – Fotos, die jemand in die eigene Zeitleiste hochgeladen hat. Sie sind nicht eingeschränkt: Der
  Besitzer kann sie ansehen, bearbeiten, teilen, veröffentlichen und endgültig löschen, wie in Immich.
- **Mediathek** – die offiziellen Fotos des Unternehmens. Sie sind in **Bereiche** aufgeteilt (zum Beispiel
  Abteilungen oder Projekte). Jeder Bereich gehört einem technischen Konto (*Mediathek: &lt;Bereich&gt;*); mit diesen
  Konten meldet sich niemand an.
- **Rolle** – wird pro Konto unter *Administration → Benutzer → Benutzer → Rolle und Rechte* festgelegt:
  - **Administrator/in** – voller Zugriff auf alles, auch auf alle Bereiche und die Administration.
  - **Mitarbeiter/in** – Beschäftigte. Der Zugriff auf die Mediathek hängt von ihrer Stufe pro Bereich ab.
  - **Extern** – zum Beispiel Fotografen oder Agenturen. Wie Mitarbeiter/innen, aber beschränkt auf ihre eigenen
    Lieferungen (siehe unten).
- **Stufe pro Bereich** – Mitarbeiter/innen und Externe erhalten für jeden Bereich, den sie brauchen, eine Stufe.
  Ohne Stufe ist der Bereich überhaupt nicht sichtbar – weder in der Zeitleiste noch in Suche, Karte oder Mobil-Apps.

| Stufe | Bedeutung |
|---|---|
| **Nur ansehen** | sieht den Bereich |
| **Standard** | sieht und lädt herunter |
| **Bearbeiter** | pflegt den Bereich: Hochladen, Nutzungsrechte, Papierkorb, Teilen |
| **Medienverantwortlich** | verantwortlich für den Bereich: entscheidet zusätzlich über den Freigabestatus und löscht endgültig (nur Mitarbeiter/innen) |

Jeder Bereich sollte mindestens eine medienverantwortliche Person haben. *Administration → Bereiche* markiert Bereiche
ohne.

## Rechtematrix (Mediathek)

✅ erlaubt · ❌ nicht erlaubt · 👤 nur für eigene Lieferungen (Fotos, die die Person in den Bereich hochgeladen hat)

| Aktion in einem Bereich | Keine Stufe | Nur ansehen | Standard | Bearbeiter (extern) | Bearbeiter (Mitarbeiter/in) | Medienverantwortlich | Administrator/in |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Bereich und Fotos sehen | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fotos zu eigenen Alben hinzufügen | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Herunterladen (mit Bildnachweis in der Datei) | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| In den Bereich hochladen, eigene Fotos zuweisen | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Nutzungsrechte eintragen | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| Schlagworte aus der Schlagwortliste zuweisen | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| Freigabestatus festlegen (freigeben, einschränken, sperren) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gesperrte Fotos herunterladen | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Beschreibung und Metadaten bearbeiten | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| In einen anderen Bereich verschieben ¹ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| In den Papierkorb verschieben und wiederherstellen | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| Papierkorb des Bereichs sehen | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| Endgültig löschen | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Geteilte Links erstellen | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| In Website-Galerien veröffentlichen | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

¹ Die Person braucht in beiden Bereichen mindestens die Stufe *Bearbeiter*.

Die Administration (Benutzer, Rollen, Bereiche, Schlagwortliste, Kanäle, Einstellungen, der Papierkorb aller Bereiche und das
Audit-Log) ist nur für Administrator/innen. Eigenen Fotos kann jeder Schlagworte zuweisen. Sobald eine
Schlagwortliste existiert, legen nur Administrator/innen neue Tags an. Die Tag-Funktion von Immich (Tag-Seite,
Tag-Panel) steht nur Administrator/innen zur Verfügung.

## Details

### Nutzungsrechte

- Jedes Foto mit Nutzungsrechten hat einen **Freigabestatus**: *In Prüfung*, *Freigegeben*, *Freigegeben mit
  Einschränkung* (mit einem Hinweis auf die Einschränkung), *Gesperrt*. *Abgelaufen* wird automatisch angezeigt,
  sobald das Ablaufdatum überschritten ist.
- Von Bearbeitern eingetragene Nutzungsrechte werden als **In Prüfung** gespeichert. Nur Medienverantwortliche des
  Bereichs und Administrator/innen legen den Freigabestatus fest; Freigaben werden im Audit-Log festgehalten.
  Änderungen durch Bearbeiter setzen freigegebene Fotos zurück auf *In Prüfung*; gesperrte Fotos bleiben gesperrt.
- Besitzer legen den Freigabestatus ihrer eigenen Fotos selbst fest.
- **Gesperrte** Fotos können nicht heruntergeladen werden (außer von Medienverantwortlichen des Bereichs und
  Administrator/innen), lassen sich nicht in neue geteilte Links aufnehmen, werden in bestehenden geteilten Links
  nicht angezeigt und erscheinen nie in Website-Galerien.
- Website-Galerien zeigen nur *freigegebene* Fotos mit Nutzungsrechten für einen Galerie-Kanal (legen Administratoren fest,
  Standard: Website und Presse), die nicht abgelaufen sind.

### Externe Bearbeiter

Externe liefern Fotos in einen Bereich: Sie laden in der Ansicht des Bereichs hoch oder weisen ihm eigene Fotos zu.
ImagePier merkt sich, wer welches Foto geliefert hat. Externe können nur ihre eigenen Lieferungen bearbeiten, in den
Papierkorb verschieben und wiederherstellen – bei einer Auswahl mit anderen Fotos werden die anderen übersprungen.
Sie können keine Fotos zwischen Bereichen verschieben, keine Links teilen und keine Galerien veröffentlichen, und sie
können nicht medienverantwortlich werden.

### Import

Bearbeiter und Medienverantwortliche finden **Import** in der Seitenleiste unter *Website-Galerien*. Damit laden sie einen
Ordner oder viele Dateien in einen Bereich, den sie bearbeiten, mit Schlagworten und Nutzungsrechten; auch Externe
können das nutzen. Medienverantwortliche können den Freigabestatus setzen, bei allen anderen sind neue Fotos
*in Prüfung*.

### Papierkorb

- Bearbeiter und Medienverantwortliche finden den **Papierkorb der Bereiche** in der Seitenleiste unter
  *Import*. Er listet die gelöschten Fotos aller Bereiche, in denen sie mindestens Bearbeiter sind, mit Bereich,
  Datum und der Person, die sie gelöscht hat, und lässt sich nach Bereich filtern.
- Bearbeiter stellen wieder her; nur Medienverantwortliche löschen endgültig (mit Rückfrage).
- Externe sehen dort nur ihre eigenen Lieferungen.
- Administrator/innen sehen den Papierkorb aller Bereiche unter *Administration → Papierkorb*.
- Fotos bleiben so lange im Papierkorb, wie in Immich eingestellt (*Administration → Einstellungen → Papierkorb*),
  und werden dann automatisch gelöscht.

### Teilen und Website-Galerien

- Ein **geteilter Link** darf nur Fotos der Mediathek aus Bereichen enthalten, in denen die erstellende Person
  mindestens *Bearbeiter* ist (Mitarbeiter/in). Bei einem Album-Link werden beim Erstellen alle Fotos des Albums
  geprüft. Eigene Fotos lassen sich immer teilen.
- Eine **Website-Galerie** zeigt nur Fotos der Mediathek aus Bereichen, in denen die veröffentlichende Person
  mindestens *Bearbeiter* ist, sowie ihre eigenen Fotos. Fotos anderer Bereiche bleiben verborgen, auch wenn sie im
  Album liegen.
- Bekannte Einschränkung: Fotos, die nach dem Erstellen eines Album-Links zum Album hinzugefügt werden, werden nicht
  erneut geprüft.

### Mobil-Apps

Die offiziellen Immich-Apps zeigen die Bereiche, in denen eine Person eine Stufe hat (über die Partnerfreigabe von
Immich). Alle Rechte werden auf dem Server geprüft; die Apps können also nicht mehr als die Web-App.
