# Example Configurations

Ce dossier contient des exemples de configurations prêtes à l'emploi pour différents niveaux d'accès.

## 📁 Fichiers disponibles

### 1. `example-config-full-access.json`
**Accès complet** - Tous les outils sont activés.

- ✅ Claude peut tout faire : lire, créer, modifier, supprimer
- ✅ Claude peut exécuter des requêtes et voir les données
- ✅ Idéal pour : développement, instances personnelles

**Outils désactivés :** Aucun

---

### 2. `example-config-schema-only.json`
**Schéma seulement** - Claude peut voir la structure mais pas les données.

- ✅ Claude peut lister les dashboards, cartes, bases de données
- ✅ Claude peut voir la configuration des cartes (requêtes SQL)
- ✅ Claude peut créer/modifier/supprimer des cartes et dashboards
- ❌ Claude ne peut PAS exécuter de requêtes
- ❌ Claude ne peut PAS voir les données réelles
- ✅ Idéal pour : aide à la conception de dashboards sans exposition de données

**Outils désactivés :**
- `execute_card`
- `execute_query`

---

### 3. `example-config-no-data.json`
**Aucune donnée** - Claude ne peut rien lire, seulement créer/modifier/supprimer.

- ❌ Claude ne peut PAS lister les dashboards, cartes, bases de données
- ❌ Claude ne peut PAS voir la configuration des cartes
- ❌ Claude ne peut PAS exécuter de requêtes
- ✅ Claude peut créer des cartes (vous lui donnez la requête)
- ✅ Claude peut modifier des cartes (vous lui donnez l'ID)
- ✅ Claude peut supprimer des objets (vous lui donnez l'ID)
- ✅ Idéal pour : production où aucune information ne doit être exposée

**Outils désactivés :**
- `execute_card` - Exécuter des cartes
- `execute_query` - Exécuter des requêtes SQL
- `list_dashboards` - Lister les dashboards
- `list_cards` - Lister les cartes
- `list_databases` - Lister les bases de données
- `list_collections` - Lister les collections
- `list_permission_groups` - Lister les groupes de permissions
- `list_users` - Lister les utilisateurs
- `get_card` - Obtenir les détails d'une carte
- `get_dashboard` - Obtenir les détails d'un dashboard
- `get_dashboard_cards` - Obtenir les cartes d'un dashboard
- `get_user` - Obtenir les détails d'un utilisateur
- `get_collection_permissions` - Obtenir les permissions d'une collection

---

## 🚀 Comment utiliser ces exemples

1. **Choisissez** le fichier qui correspond à votre niveau de sécurité
2. **Ouvrez** le fichier et copiez son contenu
3. **Modifiez** les valeurs :
   - `METABASE_URL` : L'URL de votre instance Metabase
   - `METABASE_API_KEY` : Votre clé API Metabase
4. **Collez** la configuration dans votre fichier Claude Desktop :
   - macOS : `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows : `%APPDATA%/Claude/claude_desktop_config.json`
   - Linux : `~/.config/Claude/claude_desktop_config.json`
5. **Redémarrez** Claude Desktop

## 💡 Conseil

Pour votre cas d'usage (ne pas partager de données avec Claude), utilisez **`example-config-no-data.json`**.

Avec cette configuration, Claude ne pourra voir AUCUNE information de votre Metabase, même pas les noms de dashboards ou la structure des requêtes. Il pourra seulement créer/modifier/supprimer des objets selon vos instructions explicites avec des IDs que vous lui fournirez.

## 🔄 Génération interactive

Pour générer une configuration personnalisée de manière interactive, utilisez :

```bash
npm run config
```

⚠️ **Note:** Cet outil nécessite un terminal interactif et ne peut pas être utilisé dans des environnements non-TTY.
