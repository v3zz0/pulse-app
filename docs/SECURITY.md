# Sicurezza e audit fase 4 — 16 novembre 2026

## Esito e gate di pubblicazione

Configurazione e prove locali di produzione predisposte. **Non è un'autorizzazione al go-live**: DNS pubblici, certificati ACME, lista IP reale, destinazione backup esterna e collaudo Android fisico richiedono intervento sul server. Nessun deploy remoto, modifica DNS o certificato pubblico richiesto durante questi lavori. La configurazione predefinita pubblica solo su loopback e usa una CA interna di prova.

Audit npm completo: **34 → 25 segnalazioni**, **23 → 5 high**, moderate 9 → 20, low 2 → 0, critical 0. Le severità propagate nei pacchetti Strapi cambiano insieme alla dipendenza radice: non sono 34 vulnerabilità indipendenti. Il report npm integrale è `dependency-audit.json`; nessun advisory nascosto con ignore/audit-level e nessun `audit fix --force`.

Strapi e Users & Permissions restano **5.62.0**, ultima stable verificata sul registro npm. La [release ufficiale](https://github.com/strapi/strapi/releases/tag/v5.62.0) include già correzioni di sicurezza. Non sono stati applicati downgrade a Strapi4, React Router7 o aggiornamenti major dei parser senza compatibilità dimostrata.

## Correzioni effettive

| Catena | Prima → dopo | Risultato |
|---|---|---|
| Strapi/admin/utils → Zod4 | 4.4.3 → **4.6.7** | Risolta la parte Zod4 di [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), con override ristretto alla major4 |
| Strapi/core → MCP Node → Hono adapter | MCP Node2.1.1 → **2.1.2**, adapter1.19.19 → **2.1.8** | Risolto [GHSA-rmxm-3fg6-px4f](https://github.com/advisories/GHSA-rmxm-3fg6-px4f); la nuova patch MCP ammette esplicitamente adapter2.1.3+ nel proprio range |

Build admin, unit test, API, login e browser verificano il codice effettivamente installato. Gli override sono versionati e documentati; vanno rivalutati dopo ogni aggiornamento Strapi.

## Segnalazioni residue e raggiungibilità

| Radice / severità | Contesto effettivo e mitigazione | Versione correttiva / decisione |
|---|---|---|
| **Zod3, high**: due copie tramite koa-body6.0.1 e koa-session7.0.2 | Questi parser usano Zod per **opzioni del middleware controllate dal server**, non per validare gli array JSON degli utenti: `koa-body/lib/index.js:30`, `koa-session/dist/commonjs/index.js:165/188`. Il corpo PULSE è limitato a128KiB,256 elementi per array,2048 nodi e16 livelli prima dei controller. Il root Zod4 usato da Strapi è corretto. Non è stata individuata una via da input pubblico alla validazione di collezioni Zod3 non limitate in queste due copie. | Il range dell'advisory include tutte le3.x; la patch pubblicata è4.6.6+. Non forzare Zod4 nelle API3 (`function().args()` ecc.). Koa-body8 usa4 ma Strapi richiede6; koa-session7 resta su3. **Resta nel report**, con mitigazione motivata e revisione obbligatoria a ogni modifica a parser/plugin. Le5 high aggregate sono propagate da questa radice; non dichiararle corrette. |
| React Router6 / moderate | Presente nell'admin React; il frontend PULSE usa Vue Router. Nessun SSR/hydration React, quindi lo specifico [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg) non è raggiungibile nell'architettura attuale. L'[open redirect](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) resta rilevante per link admin costruiti da dati non affidabili: admin consentito solo a IP/VPN specifici e account amministrativi fidati. | Patch7.18.0+ è major diversa dalla React Router6 richiesta da Strapi5; non applicata. Non rendere pubblico l'admin. |
| Glob13 / moderate | Scansione file all'avvio/build/CLI, nessuna API PULSE riceve pattern glob. Ridurre build a codice fidato. L'[advisory cancellazione](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) non è stato classificato come corretto o ignorato. | Patch14.0.2+ richiede major diversa da quella fissata da Strapi/rimraf; lasciata in attesa di aggiornamento compatibile. |
| Minimatch10 / moderate | Build/CLI Cloud/TypeDoc, senza pattern utente nell'API. Nessuna generazione di documentazione/cloud sul server esposto. [Advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249). | Patch11.0.1+ è major rispetto alla10 fissata da Strapi; non imposta arbitrariamente. |
| Deepmerge / low, propagata anche al checker | Il [GHSA-gcqx-w48m-w2h4 è stato ritirato](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) il16 novembre perché non descrive una vulnerabilità. Il primo audit della giornata lo includeva ancora; nell’audit finale il registro ha recepito il ritiro. Non è una patch applicata da PULSE. È inoltre nella catena del checker build, non nei controller PULSE. | Nessuna versione correttiva dichiarata; escluso dal registro npm finale in seguito al ritiro, non nascosto con configurazioni locali. |

Questa analisi è specifica del codice e delle rotte attuali. Non è una prova formale di assenza di vulnerabilità. Se si aggiungono plugin, SSR, pattern/JSON schema controllati dall'utente o accesso admin pubblico, rivalutare il rischio prima dell'esposizione. L'audit npm non è una scansione delle CVE dei layer OS: i digest sono fissati, ma vanno aggiornati e scansionati nel processo operativo.

## Controlli applicativi

- Cookie personale HttpOnly/SameSite Strict, host-only,7giorni, token casuale256bit conservato solo come SHA256 nel DB. In produzione Secure obbligatorio; `/api` resta sul dominio frontend, senza cookie Domain condiviso tra sottodomini. Logout revoca la sessione server.
- Produzione: Origin obbligatorio e uguale esattamente a `https://pulse.vezzo.vp360web.it` per le mutazioni personali; rifiuto Sec-Fetch-Site cross-site. Origin e header IP non sono credenziali e non sostituiscono ownership/cookie.
- Login: limiti persistenti in PostgreSQL,10 tentativi per account e60 per IP ogni15minuti, Retry-After. Le chiavi sono HMAC con segreto applicativo, senza email/IP grezzi. Successo rimuove il contatore account e non azzera i fallimenti di altri account sull'IP. I limiti resistono a restart e coordinano repliche; un attacco distribuito resta un tema di protezione perimetrale.
- Registrazione pubblica chiusa; native JWT login/reset/connect e MCP non utilizzati sono chiusi. Ogni rotta personale verifica l'owner sul server. Collezioni personali prive di REST CRUD generico. Test con due utenti sintetici.
- CORS solo origini note, nessun wildcard con credenziali. TRUST_PROXY solo nel Compose di produzione, Strapi senza porte host. Caddy sovrascrive gli header forwarded e non si fida di IP forniti dal client; Koa considera un solo hop. Non inserire CDN/proxy aggiuntivi senza ridefinire la catena di fiducia.
- Pannello Strapi e dominio backend consentiti solo da CIDR reali amministrativi/VPN; rate limit nativo admin attivo. Non usare `0.0.0.0/0`, `::/0` o private_ranges in produzione. Nella prima copia di collaudo è stato usato172.16/12; la prova finale lo restringe al solo gateway Docker osservato/32. Nessuno dei due valori è il default di produzione.
- CSP frontend self-only per script/connessioni, oggetti/frame/base disabilitati; style unsafe-inline necessario alle regole Vue/CSS esistenti, senza modificare il design. HSTS HTTPS, nosniff, no-referrer, Permissions-Policy e DENY. Corpo JSON/collezioni limitati; upload admin max10MiB, PDF personali mai nella Media Library pubblica.
- Access log applicativo senza URL/query, body, cookie, token o identificatori utenti; log Docker ruotati10MiB×3. Nessun access log HTTP Caddy abilitato e nessun log_credentials. Log/errori infrastrutturali restano riservati agli amministratori; non esportarli su servizi pubblici. Errori verso client generici, segreti solo in env protetti e backup cifrati.

## Privilegi PostgreSQL produzione

L’inizializzazione di un volume nuovo crea `pulse_maintenance` come bootstrap superuser e un ruolo applicativo separato NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION, proprietario del solo DB PULSE. Le password sono distinte; la password manutenzione viene passata soltanto al container PostgreSQL, mai a Strapi. L’init script non è usato dal Compose locale e non modifica volumi esistenti. Su DB già presenti serve una migrazione pianificata con backup e restore in copia; non cambiare POSTGRES_USER su un volume esistente aspettandosi che initdb venga rieseguito.
