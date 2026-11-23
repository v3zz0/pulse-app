# Inventario funzioni PULSE → nuovo design

Fonte: `frontend/src` (13 rotte + componenti). Checklist per prototipo e test.
Nuova navigazione (5 voci): **Oggi** · **Dieta** · **Allena** · **Progressi** · **Tu**.
Legenda posizione: `Tab › sezione` · `[sheet]` = bottom sheet · `[toast]` = feedback con Annulla.

## Globale (App.vue, Reminders.vue)
| # | Funzione attuale | Nel nuovo design |
|---|---|---|
| G1 | Barra superiore con avatar → account | Oggi › header, avatar → Tu |
| G2 | Banner "Riprendi allenamento" su tutte le pagine se sessione attiva | Barra flottante sopra la nav (tutte le tab tranne Allena) |
| G3 | Navigazione a 5 voci (Oggi, Dieta, Allenati, Progressi, Altro) | Nav inferiore mobile / laterale ≥900px |
| G4 | Promemoria in scadenza: rinvia 15/30/60 min, "Chiudi per oggi" | Oggi › card "Da fare adesso" + notifica/toast con stesse azioni |
| G5 | Redirect a login se non autenticato; logout broadcast tra schede | Login a schermo intero; logout da Tu |
| G6 | Avviso aggiornamento PWA | **Non nel prototipo** (nessun service worker): resta nell'app Vue |

## Login (/login)
| L1 | Email o nome utente + password, errore, stato "Accesso in corso…" | Schermata Login |

## Oggi (/ — Home.vue, TodaySupplements.vue)
| O1 | Data di oggi | Oggi › header |
| O2 | Avviso provenienza piano (CSV / storico da rivedere) | Oggi › nota sotto i pasti |
| O3 | Selettore giorno ON/OFF manuale | **Automatico** da giorni di allenamento; chip "ON · auto" → [sheet] forza ON/OFF per la data / torna ad auto |
| O4 | Progresso pasti x/n con barra | Oggi › anello progresso giornata (pasti + integratori + allenamento) |
| O5 | Prossimo pasto con "Mangiato" e "Sostituisci" | Oggi › card hero "Prossimo pasto" (1 tocco) |
| O6 | Lista pasti: segna/annulla consumo, apri alternative | Oggi › timeline pasti, tocco sul cerchio o swipe → destra segna / sinistra annulla, [toast] Annulla |
| O7 | Tutti i pasti consumati → messaggio | Oggi › stato vuoto celebrativo |
| O8 | Card allenamento "Inizia allenamento" | Oggi › card "Allenamento di oggi" (scheda suggerita dal calendario) |
| O9 | Registra peso (link) | Oggi › azione rapida → [sheet] peso |
| O10 | Promemoria (link) | Tu › Promemoria |
| O11 | Prepara domani (stato PROGRAMMATO/DA PREPARARE, ON/OFF domani) | Oggi › card "Domani" → Dieta alla data di domani |
| O12 | Link Settimana/progressi e Tutta la dieta | Coperti dalla nav |
| O13 | Integratori di oggi: elenco con orario/dose, "Segna assunto", coda offline | Oggi › riga integratori, tocco = assunto, [toast] Annulla |
| O14 | Link storico assunzioni | Tu › Integratori › Storico |

## Dieta (/dieta — Nutrition.vue, MealDialog, NutrientSummary)
| D1 | Navigazione per data (input date) + "Prepara domani" | Dieta › striscia settimana scorrevole + selettore data |
| D2 | ON/OFF per la data | Dieta › chip ON/OFF auto/manuale (come O3) |
| D3 | Titolo piano + avviso validità/provenienza | Dieta › intestazione piano |
| D4 | Giornata preparata con piano vecchio: avviso + "Usa piano attivo" (solo senza consumi) | Dieta › banner |
| D5 | Nutrienti della giornata vs obiettivi, valori sconosciuti vuoti ("somme note") | Dieta › barre macro; "—" per sconosciuti |
| D6 | Pasti: segna/annulla (disabilitato per date future) | Dieta › card pasti |
| D7 | Dialog pasto: alternative per gruppo (oppure), composizione, note, testo originale | Dieta › [sheet] pasto con gruppi choose-one |
| D8 | Sostituzione salvata; bloccata se già consumato | [sheet] pasto, opzioni disabilitate con spiegazione |
| D9 | Preferiti (food-preference) | [sheet] pasto, stella su opzione |
| D10 | Lista della spesa con spunte, porzioni, niente somme fra unità diverse | Dieta › sottosezione "Spesa" (segmento) |
| D11 | Note del piano | Dieta › "Note del piano" espandibile |
| D12 | Crea nuova dieta / Gestisci piani | Tu › Piani e schede (e scorciatoia in Dieta) |

## Allenamento (/allenati — Workout.vue, WorkoutExercise, WorkoutSetRow, FlowPlayer, FlowPicker)
| A1 | Elenco schede A/B/C con giorni in calendario, n° esercizi/serie | Allena › schede (evidenziata quella di oggi) |
| A2 | Visualizza scheda: esercizi, fase, serie, ripetizioni, recuperi, note, circuiti | Allena › dettaglio scheda |
| A3 | Animazioni esercizio (Flow), pausa/riprendi, cambia animazione (nell'editor), download offline (non nel prototipo) | Allena › esercizio, player animazione (SVG/CSS nel prototipo) |
| A4 | Carico standard per serie, "Aggiorna standard" con conferma | Allena › esercizio, azione esplicita + [sheet] conferma |
| A5 | Ultimo risultato precedente per serie | Allena › riga serie, "ultima volta" |
| A6 | Inizia allenamento (bloccato con coda non sincronizzata) | Allena › pulsante grande |
| A7 | Sessione: kg seduta e rip. effettive per serie, completa con/senza peso, salta serie | Sessione guidata a schermo intero, 1 tocco per serie |
| A8 | Proposta rapida ripetizioni (range) | Sessione › chip ripetizioni |
| A9 | Salta esercizio, mostra tutti, avanzamento serie completate/rimanenti | Sessione › menu esercizio + barra avanzamento |
| A10 | Timer recupero persistente (+tempo/salta), recupero manuale in secondi | Sessione › timer circolare, +15 s, Salta, recupero manuale |
| A11 | Defaticamento | Sessione › ultimo passo |
| A12 | Concludi / Annulla con conferma (conteggio serie fatte) | Sessione › [sheet] conferma |
| A13 | Ripresa dopo reload, stato sincronizzazione, conflitto, riprova | Ripresa da localStorage; indicatore "Salvato" |
| A14 | Organizza schede: nome, descrizione, giorni calendario, fuso | Tu › Piani e schede › Organizza (+ giorni di allenamento che guidano ON/OFF) |
| A15 | Crea/Modifica scheda, Gestisci schede | Tu › Piani e schede |
| A16 | kg di oggi ≠ standard (invariante) | Sessione: campo "oggi" separato dallo standard, mai sovrascritto |

## Progressi (/progressi — Progress.vue, LineChart)
| P1 | Intervallo (periodi) | Progressi › segmento intervallo |
| P2 | Peso: ultima, differenza, grafico | Progressi › card peso |
| P3 | Frequenza: settimana, mese, ultime 6 settimane | Progressi › card frequenza |
| P4 | Carichi per esercizio, miglior carico, tabella dati | Progressi › card carichi con selettore |
| P5 | Calendario mensile con navigazione | Progressi › calendario |
| P6 | Volume per seduta (parziale segnalato) | Progressi › card volume |
| P7 | Ultimi 7 giorni: pasti consumati/pianificati | Progressi › card nutrizione |
| P8 | Storico allenamenti con dettaglio serie (standard all'avvio vs eseguito) | Progressi › storico espandibile |

## Tu (ex Altro, Account, Integratori, Promemoria, Piani)
| T1 | Installa PULSE (istruzioni per piattaforma) | Tu › Installa app [sheet] |
| T2 | Registra peso (30–300 kg nel nuovo), data ≤ oggi, ultimi 14 | Tu › Peso (+ O9) |
| T3 | Integratori: crea/modifica/elimina, nome, quantità, unità, n° assunzioni/giorno, orari | Tu › Integratori [sheet] |
| T4 | Integratori: giorni della settimana, ON/OFF/sempre (supplement-day) | Tu › Integratori [sheet] (nuovo campo esplicito) |
| T5 | Storico assunzioni: rettifica quantità, annulla registrazione | Tu › Integratori › Storico |
| T6 | Promemoria: elenco, attiva/disattiva, modifica, elimina | Tu › Promemoria |
| T7 | Wizard 4 passi: tipo (pasto/integratore/allenamento/peso/personalizzato), nome, attività collegata, orario, fuso, giorni, riepilogo | Tu › Promemoria [sheet a passi] |
| T8 | Notifiche: consenso, stato, push on/off (push solo nell'app reale), notifica di prova | Tu › Promemoria › Notifiche (Notification API + fallback toast) |
| T9 | Non notificare azione già completata | Logica scheduler prototipo |
| T10 | Contenuto del pasto nella notifica | Testo notifica pasto |
| T11 | Piani/schede: versioni salvate, stato bozza/attivo/archiviato, modifica, duplica, attiva, elimina, export CSV | Tu › Piani e schede |
| T12 | Pianificazione piano (settimanale, primo giorno) | **Sostituita** dal calendario ON/OFF automatico (Tu › Preferenze) |
| T13 | Attivazione con differenze e trasferimento carichi esatti + conferme | [sheet] attivazione |
| T14 | Import CSV: scarica esempio, istruzioni AI (+preferenze opzionali), file, errori/avvisi per riga, anteprima, differenze, conferma bozza | Tu › Piani e schede › Importa [sheet] |
| T15 | Editor visuale dieta: calendario giornaliero/settimanale, pasti, menu alternativi, gruppi, alimenti, quantità/unità, note, riordino | Tu › Piani › Editor (modalità semplice/avanzata) |
| T16 | Editor visuale scheda: giornate, esercizi, serie (tipo, rip., per gamba), animazioni, defaticamento. Circuiti e libreria esercizi Flow non nel prototipo | Tu › Schede › Editor (semplice/avanzata) |
| T17 | Preferenze alimentari (preferiti/non graditi) e obiettivi kcal/P/C/F indicativi | Tu › Preferenze e obiettivi |
| T18 | Credenziali: nome utente (3–64), password attuale, nuova (≥12, conferma) | Tu › Account |
| T19 | Esci | Tu › Account |
| T20 | Nuovo: giorni di allenamento della settimana (guidano ON/OFF) | Tu › Preferenze, e Allena › Organizza |
| T21 | Nuovo: tema chiaro/scuro, "Azzera dati demo" | Tu › Aspetto / Demo |
