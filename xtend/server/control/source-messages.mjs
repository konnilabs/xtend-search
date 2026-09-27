// Public, allowlisted explanations. Never render raw provider exception text,
// URLs, credentials, policy fingerprints or internal budget values.
const failures={
 captcha:'Der Anbieter verlangt eine Bestätigung (CAPTCHA).',
 access_denied:'Der Anbieter verweigert den Zugriff.',
 rate_limit:'Das Anfragelimit des Anbieters ist erreicht.',
 timeout:'Die Quelle hat nicht rechtzeitig geantwortet.',
 backend_unavailable:'Die Verbindung zum Suchdienst ist gestört.',
 backend_ingress_limit:'Das Anfragelimit des Suchdienstes ist erreicht.',
 schema_invalid:'Die Antwort hat ein unerwartetes Format.',
 wrong_result_type:'Die Antwort passt nicht zum Suchmodus.',
 unsafe_url_scheme:'Die Antwort enthält eine nicht unterstützte Zieladresse.',
 network:'Die Verbindung zur Quelle ist gestört.',
};
const skipped={
 quality_cooldown:'Die Quelle pausiert nach Qualitätsmeldungen in dieser Kategorie.',
 budget:'Das verfügbare Suchbudget ist derzeit ausgeschöpft.',
 capability_changed:'Die Quellenfreigabe muss nach einer Änderung erneut bestätigt werden.',
 provider_family_cooldown:'Die Anbietergruppe pausiert nach einem Quellenfehler.',
 cooldown:'Die Schutzfrist der Quelle läuft noch.',
 watch_required:'Die Quelle wartet auf eine erfolgreiche Betriebsprüfung.',
 quarantine:'Die Quelle ist zur Prüfung ausgesetzt.',
 admin_disabled:'Die Quelle ist nicht freigegeben.',
 drained:'Die Quelle befindet sich in einer Betriebspause.',
 storage_unavailable:'Die Quellenfreigabe konnte nicht zuverlässig geprüft werden.',
 backend_unavailable:failures.backend_unavailable,
 safesearch:'Die Quelle unterstützt den gewählten SafeSearch-Filter nicht.',
 language:'Die Quelle unterstützt die gewählte Sprache nicht.',
 time_range:'Die Quelle unterstützt den gewählten Zeitraum nicht.',
 paging:'Die Seitennavigation dieser Quelle ist nicht freigegeben.',
 knowledge_source:'Diese Quelle ist für die separat abgefragten Wissenskarten vorgesehen.',
};
export const sourceFailureMessage=(id,code)=>`${id}: ${Object.hasOwn(failures,code)?failures[code]:'Die Quelle meldet einen Fehler.'}`;
export const sourceSkippedMessage=(id,code)=>`${id}: ${Object.hasOwn(skipped,code)?skipped[code]:'Die Quelle konnte nicht ausgeführt werden.'}`;
