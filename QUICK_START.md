# Quick Start Guide

Si vous rencontrez des problèmes avec les générateurs de configuration interactifs, utilisez cette méthode simple en ligne de commande.

## Méthode Rapide (Recommandée)

### Syntaxe

```bash
npm run config:quick -- <mode> <metabase_url> <api_key>
```

### Modes Disponibles

1. **`full`** - Accès complet
   - Tous les outils activés
   - Claude peut tout lire et modifier

2. **`schema`** - Schéma seulement
   - Désactive: `execute_card`, `execute_query`
   - Claude peut voir la structure mais pas les données

3. **`nodata`** - Aucune donnée
   - Désactive tous les outils de lecture et de requête
   - Claude ne peut rien voir, seulement créer/modifier/supprimer

### Exemples

#### Mode "No Data" (Pour ne pas partager de données avec Claude)

```bash
npm run config:quick -- nodata https://votre-metabase.com votre_api_key
```

#### Mode "Schema Only" (Pour voir la structure sans les données)

```bash
npm run config:quick -- schema https://votre-metabase.com votre_api_key
```

#### Mode "Full Access" (Accès complet)

```bash
npm run config:quick -- full https://votre-metabase.com votre_api_key
```

## Ce qui se passe

La commande va:
1. ✅ Générer la configuration JSON
2. ✅ L'afficher dans votre terminal
3. ✅ Montrer où la coller (chemin du fichier Claude Desktop)
4. ✅ Proposer de la sauvegarder dans un fichier (optionnel)

## Étapes de Configuration

1. **Exécutez** la commande avec vos paramètres
2. **Copiez** le JSON affiché
3. **Ouvrez** le fichier de configuration Claude Desktop:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`
4. **Collez** la configuration dans le fichier
5. **Sauvegardez** et redémarrez Claude Desktop

## Exemple Complet

```bash
# Votre commande
npm run config:quick -- nodata https://metabase.example.com mb_abc123xyz

# Output que vous recevrez:
========================================
📋 Generated Configuration
========================================

{
  "mcpServers": {
    "metabase-server": {
      "command": "metabase-server",
      "env": {
        "METABASE_URL": "https://metabase.example.com",
        "METABASE_API_KEY": "mb_abc123xyz",
        "METABASE_DISABLED_TOOLS": "execute_card,execute_query,list_dashboards,..."
      }
    }
  }
}

========================================
📍 Config File Location
========================================
/Users/you/Library/Application Support/Claude/claude_desktop_config.json

========================================
🔧 Setup Instructions
========================================
1. Copy the configuration above
2. Paste it into your Claude Desktop config file
3. If you have other MCP servers, merge the "metabase-server" entry
4. Save and restart Claude Desktop
========================================

⚠️  Mode: No Data Access
Disabled: All read and query operations
```

## Comparaison des Modes

| Mode | Peut lire la structure | Peut exécuter des requêtes | Peut créer/modifier |
|------|------------------------|----------------------------|---------------------|
| `full` | ✅ Oui | ✅ Oui | ✅ Oui |
| `schema` | ✅ Oui | ❌ Non | ✅ Oui |
| `nodata` | ❌ Non | ❌ Non | ✅ Oui |

## Pour votre cas d'usage

Vous voulez que Claude ne voie **aucune donnée** → Utilisez le mode **`nodata`**

```bash
npm run config:quick -- nodata https://votre-metabase.com votre_api_key
```

Avec ce mode:
- ❌ Claude ne peut PAS voir les noms de dashboards
- ❌ Claude ne peut PAS voir les requêtes existantes
- ❌ Claude ne peut PAS exécuter de requêtes
- ✅ Claude PEUT créer des cartes (vous lui donnez la requête SQL)
- ✅ Claude PEUT modifier des cartes (vous lui donnez l'ID)
- ✅ Claude PEUT créer des dashboards

## Aide

Pour voir l'aide:

```bash
npm run config:quick -- --help
```
