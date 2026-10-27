# Informativa sulla privacy

Ultimo aggiornamento: 27 ottobre 2026. Questo documento spiega quali dati raccoglie questo server di XNova Reforged, perché, per quanto tempo e come esercitare i tuoi diritti.

## 1. Titolare del trattamento

**{{OPERATOR}}** gestisce questo server e decide quali dati vengono raccolti. Contatto per domande e richieste: **{{CONTACT}}**.

## 2. Dati raccolti

| Dato | Finalità | Conservazione |
|---|---|---|
| Nome giocatore | Identificazione nel gioco, classifiche, messaggi, galassia (visibile agli altri giocatori) | Finché esiste l'account |
| Indirizzo email (e la sua forma canonica: senza alias «+etichetta» né punti di Gmail) | Accesso, conferma dell'account, password dimenticata, rilevamento degli account multipli | Finché esiste l'account |
| Password | Accesso. Viene conservata solo un'**impronta Argon2**, mai la password | Finché esiste l'account |
| Indirizzo IP (IPv4, o prefisso /64 per IPv6), visto alla registrazione, all'accesso e al rinnovo della sessione | Controllo degli account multipli e sicurezza | **90 giorni** dopo l'ultima osservazione per impostazione predefinita (modificabile dal gestore), eliminazione automatica ogni notte |
| Dati di gioco: pianeti, edifici, ricerche, flotte, rapporti, messaggi privati, alleanza, missioni, mercato | Funzionamento del gioco | Finché esiste l'account |
| Sessioni: impronta del token di rinnovo, date | Restare connessi, poter revocare una sessione | Al massimo 30 giorni per sessione |
| Token email (solo impronta) | Conferma dell'indirizzo, reimpostazione della password | Fino alla scadenza |
| Incidenti tecnici: errori del server, con password, token, cookie, indirizzi email e messaggi privati mascherati | Manutenzione e sicurezza | 30 giorni per impostazione predefinita (modificabile dal gestore) |
| Registro di controllo delle azioni di amministrazione | Responsabilità degli amministratori | Finché necessario |

Nessun dato viene venduto né usato per pubblicità o profilazione. Il sito non usa alcuno strumento di misurazione del pubblico.

## 3. Basi giuridiche

Esecuzione del servizio da te richiesto (account, gioco, email di servizio); legittimo interesse del gestore a proteggere il servizio e a far rispettare la regola «un account per persona» (indirizzi IP ed email canonica).

## 4. Destinatari

I tuoi dati sono accessibili al gestore e agli amministratori designati. Le email di servizio passano per il server di invio (SMTP) scelto dal gestore. Se il gestore attiva il monitoraggio esterno degli errori **Sentry** (facoltativo, disattivato per impostazione predefinita), i rapporti di errore mascherati vengono trasmessi a tale fornitore, che può trattarli fuori dall'Unione europea.

## 5. Cookie e archiviazione del browser

Il sito usa solo elementi **necessari al suo funzionamento**, senza tracciamento pubblicitario:

- `xnova_access`: cookie di accesso (token di accesso);
- `NEXT_LOCALE`: cookie che ricorda la lingua scelta (un anno);
- archiviazione locale del browser: `xnova-auth` (stato della sessione) e `xnova-planet` (pianeta selezionato).

Disconnettersi elimina il cookie di accesso.

## 6. I tuoi diritti

Puoi chiedere l'**accesso** ai tuoi dati, la loro **rettifica**, la **cancellazione**, la **portabilità**, oppure **opporti** al trattamento, scrivendo a **{{CONTACT}}**. Non esiste ancora un pulsante per eliminare l'account: il gestore gestisce la richiesta ed elimina l'account e i suoi dati di gioco, salvo ciò che la legge obbliga a conservare. Puoi anche presentare reclamo all'autorità per la protezione dei dati del tuo paese (in Italia, il Garante per la protezione dei dati personali).

## 7. Sicurezza

Password con hash (Argon2), sessioni revocabili, token conservati come impronte, segreti di configurazione cifrati a riposo. Nessun sistema è infallibile: segnala ogni falla a **{{CONTACT}}**.

## 8. Modifiche

Questa informativa può cambiare; la data sopra viene allora aggiornata. Le [condizioni d'uso](/{{LOCALE}}/terms) completano questo documento.
