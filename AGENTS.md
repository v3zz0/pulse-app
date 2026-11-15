# PULSE

Usare lo stesso checkout: task cloud già isolati, niente worktree salvo richiesta.
Leggere PULSE_Starter_Codex_Cloud/PULSE_PROMPT_CODEX.md, IMPLEMENTATION_PLAN.md e docs/DATA_MODEL.md.
Solo Vue 3, JavaScript, Strapi 5, PostgreSQL, Docker; niente TypeScript nei sorgenti o config del progetto.
Preservare demo e PDF originali. Non pubblicare PDF, segreti, dati clinici o seed personali negli asset o immagini.
Frontend: cd frontend && npm ci && npm run build && npm test; npm run test:e2e per browser.
Backend: cd backend && npm ci && npm run build. Configurazione PostgreSQL obbligatoria.
Compose: node infra/init-env.js solo se .env manca; docker compose up -d --build --wait.
Aggiornare docs/VALIDATION.md con risultati reali. Non spacciare demo, test non eseguiti o placeholder per funzionalità persistenti.
Non confondere carico standard e peso effettivo. Ogni operazione personale futura richiede ownership server-side.

Workflow Git: lavorare su main, sincronizzare origin/main prima delle attività. Nessun nuovo branch o PR. Dopo ogni attività completata eseguire build/test, commit descrittivo, push non forzato su origin/main e verifica SHA remoto. Se il push è negato fermarsi e spiegare, senza creare PR.
