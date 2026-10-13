# Amtliche DWD-Warngebiete

`warncells.json` enthält exakte WGS84-Ringe aus den vier in `provenance.json` dokumentierten amtlichen DWD-Shape-Archiven: Gemeinden, Landkreise, See- und Küstengebiete. Quelle und Urheber: Deutscher Wetterdienst (DWD). Die Datei dient ausschließlich dem serverseitigen WARNCELLID-Fallback und wird nicht an Browser übertragen.

`xtend/scripts/prepare-dwd-geometries.py` liest die gepinnten DBF/SHP-Dateien ohne zusätzliche GIS-Abhängigkeit. Ringe werden nicht vereinfacht; Verschachtelung bestimmt Ausschlussflächen unabhängig von der Ringrichtung. Eingabe- und Ausgabe-SHA-256 sowie Konvertierungszeit und Gebietszahlen stehen in der Provenienz. Neue Gebietsstände erfordern eine bewusste Aktualisierung und Prüfung; die Anwendung lädt keine unversionierten Geometrien nach.

Herkunft und Nutzungsbedingungen: [DWD Open Data](https://www.dwd.de/DE/leistungen/opendata/opendata.html), [offizielle CAP-Gebietsdateien](https://www.dwd.de/DE/leistungen/opendata/hilfe.html?lsbId=627548). Die Quellenangabe wird in About und bei den amtlichen Warnungen angezeigt.
