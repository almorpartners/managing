# Mon commerce — dashboard privé

V1 volontairement simple : React + Vite + Supabase + Recharts.

## 1. Installer

```bash
npm install
```

## 2. Créer le projet Supabase

1. Créez un projet sur Supabase.
2. Ouvrez `SQL Editor`.
3. Copiez le contenu de `supabase/schema.sql`.
4. Exécutez-le.
5. Dans `Authentication > Users`, créez votre utilisateur avec l'adresse email qui sera utilisée pour vous connecter.
6. Gardez cette adresse dans `VITE_AUTH_EMAIL`.

## 3. Variables

Copiez `.env.example` vers `.env` et renseignez :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_EMAIL`

La clé `anon` peut être utilisée dans le frontend avec les règles RLS activées. Ne mettez jamais une clé `service_role` dans `.env` côté frontend.

## 4. Lancer

```bash
npm run dev
```

Puis ouvrez l'adresse indiquée par Vite.

## 5. GitHub / déploiement

Le projet peut être poussé sur GitHub puis déployé sur Vercel ou Netlify.

Ajoutez les trois mêmes variables d'environnement dans les réglages du projet de déploiement.

## Ce que fait cette V1

- Connexion sécurisée via Supabase Auth
- Solde calculé automatiquement
- Revenus / dépenses
- Graphique 7 jours
- Projets et progression
- Liste de tâches
- Parcours de vente
- Notifications internes
- Mode sombre

Les notifications sont volontairement internes à l'application : pas de push, email ou service supplémentaire dans cette première version.
