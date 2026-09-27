import {FEEDBACK_REASONS} from './feedback.mjs';
import {escapeHtml as e} from './about.mjs';
export function feedbackForm({ticket,url,csrf,error='',reason='',includeUrl=false}){
 return '<form id="feedback-form" action="/feedback" method="post" data-xtend-native>'+
 '<input type="hidden" name="ticket" value="'+e(ticket)+'"><input type="hidden" name="csrf" value="'+e(csrf)+'">'+
 '<p>Was stimmt mit diesem Ergebnis nicht? Die Meldung wird den tatsächlich beteiligten Suchquellen zugeordnet.</p>'+
 '<label class="field">Meldegrund<select name="reason" required><option value="">Bitte auswählen</option>'+
 Object.entries(FEEDBACK_REASONS).map(([id,label])=>'<option value="'+id+'"'+(reason===id?' selected':'')+'>'+label+'</option>').join('')+
 '</select></label><label class="check-field"><input type="checkbox" name="includeUrl"'+(includeUrl?' checked':'')+'> Ergebnislink zur Prüfung mitsenden</label>'+
 '<p class="feedback-url">'+e(url)+'</p><p class="muted">Ohne Zustimmung speichern wir keinen Ergebnislink. Freiwillige Belege sind nur für Operatoren und Administratoren sichtbar und werden spätestens nach sieben Tagen gelöscht. Suchbegriffe, Titel und Beschreibung werden nicht gespeichert. Ein kurzlebiger Cookie begrenzt wiederholte Meldungen.</p>'+
 '<p class="feedback-error" role="alert">'+e(error)+'</p><button type="submit">Meldung senden</button></form>';
}
