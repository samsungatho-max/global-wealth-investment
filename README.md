# Global Wealth Investment — Plateforme internationale d'investissement

> « Chaque investissement mérite une vision. Chaque ambition mérite une croissance durable. »

Application web complète et fonctionnelle : site public multilingue, simulateur, espace investisseur sécurisé, module de dépôts/retraits avec vérification, administration complète et journal d'audit inaltérable.

## Démarrage rapide

Prérequis : **Node.js 22.5 ou plus récent** (la base SQLite intégrée à Node est utilisée ; aucun serveur de base de données à installer).

```bash
npm install
cp .env.example .env      # puis adapter les valeurs
npm start                 # http://localhost:3000
```

Au premier démarrage :
- un **compte administrateur** est créé. Sans `ADMIN_PASSWORD` dans `.env`, le mot de passe est généré et écrit dans `data/initial-admin.txt` (supprimez ce fichier après la première connexion et changez le mot de passe). Connexion : `/admin/login` ;
- les **pages institutionnelles** sont créées (modifiables dans l'administration) ;
- **4 fiches de démonstration** sont créées, affichées partout comme « projet fictif » et non investissables. Archivez-les avant l'ouverture au public (ou `SEED_DEMO=false`).

Sans SMTP configuré, **aucun e-mail n'est envoyé** (codes de confirmation compris) : voir la section « E-mails et code de confirmation ».

| Commande | Rôle |
|---|---|
| `npm start` | Lance le serveur |
| `npm run dev` | Lance avec rechargement automatique |
| `npm run check` | Test de bout en bout (20 scénarios, base temporaire) |
| `npm run backup` | Sauvegarde cohérente de la base et des fichiers dans `backups/` |

## Fonctionnalités

**Site public (FR / EN / ES / DE)** — accueil avec les engagements, les secteurs et les opportunités ouvertes ; fiches projets (pays, montant recherché, montant mobilisé **calculé uniquement depuis les investissements enregistrés**, durée, risque de 1 à 5 expliqué, conditions, frais, documents) ; boutons « Consulter les détails du projet » et « Manifester mon intérêt » ; simulateur (capitalisation annuelle, hypothèses négatives possibles, EUR/USD/GBP/FCFA) ; actualités et rapports ; pages institutionnelles ; contact. Montants affichables en EUR, USD, GBP et FCFA : taux BCE mis à jour toutes les 12 h, date du taux affichée, FCFA à parité fixe 655,957.

**Espace investisseur** — inscription (nom, e-mail, pays, téléphone), vérification de l'e-mail, connexion, mot de passe oublié (code à 6 chiffres), 2FA TOTP optionnelle, KYC (pièce d'identité + justificatif de domicile) ; tableau de bord : capital investi, valeur estimée, solde, historique des transactions, valorisations réelles datées, investissements actifs/échus, documents, demandes de retrait et leur statut, notifications. **Aucun solde n'est stocké ni modifiable** : tout est recalculé depuis les écritures confirmées.

**Dépôts et retraits** — aucune opération avant validation KYC ; le dépôt reçoit une référence unique et reste « en attente » jusqu'à ce qu'un administrateur confirme la réception effective (case de contrôle + référence bancaire obligatoires) ; retrait uniquement vers un compte au nom du client (contrôle du titulaire, validation IBAN), frais et délais paramétrables, fonds réservés pendant le traitement ; notification interne + e-mail à chaque étape. La réception de fonds est **désactivée par défaut** et ne peut être activée qu'en confirmant la détention des autorisations réglementaires.

**Administration** (`/admin`, réservée au rôle admin) — projets (création, modification, photos, documents publics ou réservés, publication, suspension, clôture, archivage) ; intérêts manifestés ; investisseurs (suspension, rôles, documents contractuels et relevés, enregistrement d'investissements, valorisations datées avec justification, clôture à l'échéance) ; KYC ; dépôts/retraits ; messages clients avec réponse par e-mail ; actualités et rapports ; pages ; paramètres (informations légales, langues, devises, simulateur, instructions de paiement, frais, taux) ; journal d'audit ; tentatives de connexion. L'interface d'administration est en français ; les contenus se saisissent dans les 4 langues.

## Photos

Les 18 photos d’illustration (immobilier, villas, réunions, agriculture, industrie, énergies renouvelables, logistique, graphiques financiers) proviennent d’Unsplash (licence Unsplash : usage commercial autorisé). Elles sont hébergées localement dans `public/img/photos/` en WebP à deux tailles (800 px et 1600 px), chargées en différé, et **signalées sur le site comme « photo d’illustration »** ; la page `/credits` crédite chaque photographe. Elles ne représentent ni les projets, ni des clients, ni l’équipe. Pour un projet réel, téléversez sa vraie photo depuis l’administration : elle remplace alors l’illustration du secteur. Registre : `src/lib/photos.js`.

## E-mails et code de confirmation

**Sans serveur SMTP configuré, aucun e-mail ne part** (c'était la cause des codes non reçus). Le site l'indique désormais clairement au client et dans **Admin > E-mails / Journal d'envoi**.

- À l'inscription, un **code à 6 chiffres** est généré (valable 15 min, 5 essais), stocké uniquement sous forme de HMAC, et envoyé par e-mail (texte + HTML compatible Gmail, Outlook, Yahoo). Il n'est jamais affiché sur le site.
- **« Renvoyer le code »** : 60 s minimum entre deux envois, 5 codes par heure au maximum ; le nouveau code est toujours différent et l'ancien est invalidé.
- Chaque envoi est journalisé avec des étapes distinctes : **code généré → accepté par le serveur SMTP → remis au serveur destinataire (via webhook) → compte confirmé**. Les erreurs temporaires (4xx, réseau) sont retentées 3 fois ; les erreurs définitives (5xx) sont enregistrées avec la réponse exacte du serveur.
- L'administration propose : test de connexion SMTP, **envoi d'un e-mail de test**, diagnostic DNS (MX, SPF, DKIM, DMARC) du domaine d'envoi, renvoi du code depuis la fiche d'un investisseur.

### Mise en service (exemple avec Brevo)
1. Créez un compte sur un service d'envoi transactionnel (Brevo, Postmark, Mailgun, SendGrid, Amazon SES…).
2. Ajoutez **votre domaine** chez ce service et publiez chez votre registrar les enregistrements fournis : **SPF** (TXT `v=spf1 include:… ~all`), **DKIM** (TXT ou CNAME), puis **DMARC** (TXT `_dmarc` : `v=DMARC1; p=none; rua=mailto:dmarc@votre-domaine.com`).
3. Renseignez `SMTP_*` et `MAIL_FROM` (adresse de ce domaine) dans l'environnement, puis redémarrez.
4. Dans **Admin > E-mails** : « Tester la connexion SMTP », « Analyser » le domaine (tout doit être OK), puis « Envoyer un e-mail de test » vers une adresse **Gmail** et une adresse **Outlook** ; vérifiez la réception et le dossier spam.
5. Recommandé : déclarez le webhook `https://votre-domaine/webhooks/email?token=<EMAIL_WEBHOOK_TOKEN>` pour suivre la remise réelle et les rebonds.

## Sécurité

- Mots de passe bcrypt (coût 12), sessions en base (cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production), régénération de session à la connexion, révocation des sessions au changement de mot de passe.
- Jeton CSRF sur tous les formulaires ; en-têtes de sécurité Helmet avec CSP stricte (aucun script inline).
- Blocage après 5 échecs de connexion en 15 min, limitation de débit sur l'authentification et les formulaires ; toutes les tentatives sont journalisées.
- 2FA TOTP (Google/Microsoft Authenticator, Authy…).
- Documents KYC et contrats stockés hors du dossier public, servis uniquement après contrôle d'accès ; chaque consultation d'un document KYC est tracée.
- Journal d'audit en **ajout seul** : des déclencheurs SQL refusent toute modification ou suppression.
- Écritures financières en transactions SQL (pas de double retrait concurrent).

## Mise en production — liste de contrôle

1. **Réglementaire** : obtenir les autorisations requises dans chaque juridiction visée *avant* d'activer la réception de fonds. Renseigner dans **Paramètres** la raison sociale, l'immatriculation, l'adresse, le statut réglementaire exact et l'hébergeur. Ne jamais présenter la société comme une banque ou un établissement agréé si ce n'est pas le cas.
2. **Juridique** : faire valider par un avocat les conditions générales, la politique de confidentialité, les mentions légales et la politique de risques (modèles fournis, marqués comme tels).
3. **Contenu** : archiver les fiches de démonstration ; publier uniquement des projets réels et documentés, sans rendement garanti.
4. **Technique** : `NODE_ENV=production`, `SESSION_SECRET` aléatoire (≥ 32 caractères), HTTPS via un reverse proxy (Nginx, Caddy…) avec `TRUST_PROXY=1`, SMTP transactionnel, `npm run backup` planifié chaque jour et sauvegardes copiées hors du serveur, 2FA activée pour chaque administrateur.
5. **Paiements** : le parcours actuel est le virement bancaire avec rapprochement manuel. Pour un prestataire (Stripe ou autre prestataire autorisé), vérifier d'abord l'éligibilité de votre activité auprès du prestataire, puis créer la transaction `deposit` en `pending` au moment de la session de paiement et ne la passer en `confirmed` que sur réception du webhook signé de paiement réussi (même logique que `POST /admin/transactions/:id/action`).

## Architecture

```
src/
  server.js          Application Express (sécurité, sessions, i18n, routes)
  db.js              Schéma SQLite (node:sqlite), triggers d'audit
  seed.js            Admin initial, pages, fiches de démonstration
  i18n.js, locales/  Traductions FR / EN / ES / DE
  lib/               ledger (soldes calculés), security, totp, mailer, notify, money, rates, settings, audit
  routes/            public, auth, account (investisseur), admin
views/               Gabarits EJS (public, auth, account, admin, partials)
public/              CSS, JS client, favicon
scripts/             smoke-test.js (tests de bout en bout), backup.js
data/                Base, fichiers téléversés, e-mails de dev (non versionné)
```

Tous les montants sont stockés en centimes d'euro (entiers) ; les autres devises sont uniquement des conversions d'affichage.

---

*« Construire aujourd'hui, développer demain et créer une valeur durable pour les générations futures. »*
