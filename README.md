# Music Quiz

Hör rein, dreh die CD und errate Titel, Interpret und Jahr. Die Ausschnitte (30 s) kommen live von Deezer, ein Account ist nicht nötig.

**Spielen:** https://f2yts24nwd-cell.github.io/Music-quiz/ (auf dem iPhone über Teilen → „Zum Home-Bildschirm“ als App ablegen)

## Funktionen
- CD zum Vor- und Zurückspulen mit dem Finger drehen
- Verschwommenes Cover als Hinweis nach 10 oder 20 s Hörzeit: groß im Jogwheel, wird mit weiterer Hörzeit schärfer
- Tipps (je −1): Interpret- und Titelbuchstaben, 50:50 beim Jahr, Cover
- Schnell erkannt: bis 5 s Hörzeit +2, bis 12 s +1 (außer Blitz und Intro-Profi)
- Combo: Titel und Interpret 3× am Stück richtig = Punkte ×1,5, ab 5× = ×2
- Rückblick nach der Runde mit Cover, Treffern und Deezer-Link
- Tages-Challenge teilen wie bei Wordle (🟩🟨🟥, schnellster Treffer, Combo)
- Schwierigkeit Leicht / Normal / Profi, Feineinstellungen unter „Erweitert“
- Modi: Klassisch, Blitz, Intro-Profi, Sudden Death, Party (2–6 Spieler), Tages-Challenge
- 15 Genres: rund 670 fest kuratierte Songs plus automatisch geladene Deezer-Playlists (einige hundert Songs pro Genre, 3 Tage zwischengespeichert); Jahr = früheste Veröffentlichung; gerade gespielte Songs kommen erst wieder, wenn alle anderen dran waren
- DJ-Mixer QM-900: 3-Band-EQ mit Kill, Filter, VU-Meter, Kanal- und Tempofader, Beat-FX (Echo, Reverb, Flanger, Trans), 8 Sampler-Pads
- Einstellungen, Bestenliste und Rekorde (auf dem Gerät gespeichert), iPad-Layout

## Neues Genre hinzufügen
1. Eine Datei in `genres/` nach dem Muster der anderen anlegen: `[Interpret, Titel, [Jahr(e)]]`.
2. In `index.html` eine `<script src="genres/…">`-Zeile ergänzen.
