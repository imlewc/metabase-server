# Installation Complète - Guide Pas à Pas

## Étape 1: Installer le MCP Server

Vous êtes ici: `/Users/thomas/Code/metabase-server-mcp`

### Sur macOS/Linux:

```bash
./install.sh
```

### Sur Windows:

```powershell
.\install.ps1
```

**⚠️ Note pour Windows:** Exécutez PowerShell en tant qu'Administrateur (clic droit → Exécuter en tant qu'administrateur)

### Ce que fait le script:

1. ✅ Vérifie que Node.js et npm sont installés
2. ✅ Installe les dépendances du projet
3. ✅ Compile le TypeScript en JavaScript
4. ✅ Installe la commande `metabase-server` globalement
5. ✅ Affiche les prochaines étapes

## Étape 2: Générer votre Configuration

Une fois installé, générez votre configuration pour Claude Desktop:

```bash
npm run config:quick -- nodata https://VOTRE_METABASE_URL VOTRE_API_KEY
```

**Exemple:**
```bash
npm run config:quick -- nodata https://metabase.votreentreprise.com mb_abc123xyz
```

### Les 3 modes disponibles:

| Mode | Commande | Description |
|------|----------|-------------|
| **nodata** | `npm run config:quick -- nodata ...` | ❌ Aucune donnée visible (recommandé pour la sécurité) |
| **schema** | `npm run config:quick -- schema ...` | 👁️ Voir la structure mais pas les données |
| **full** | `npm run config:quick -- full ...` | ✅ Accès complet |

### Pour votre cas (ne pas partager de données):

Utilisez le mode **`nodata`** - Claude ne verra RIEN de votre Metabase, seulement créer/modifier selon vos instructions.

## Étape 3: Configurer Claude Desktop

### 1. Copiez la configuration JSON

Le script affichera quelque chose comme:

```json
{
  "mcpServers": {
    "metabase-server": {
      "command": "metabase-server",
      "env": {
        "METABASE_URL": "https://...",
        "METABASE_API_KEY": "...",
        "METABASE_DISABLED_TOOLS": "..."
      }
    }
  }
}
```

### 2. Ouvrez le fichier de configuration Claude Desktop

**macOS:**
```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```
Ou avec nano:
```bash
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```powershell
notepad $env:APPDATA\Claude\claude_desktop_config.json
```

**Linux:**
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

### 3. Collez la configuration

**Si le fichier est vide ou nouveau:**
Collez directement la configuration générée.

**Si le fichier contient déjà d'autres MCP servers:**
Ajoutez seulement la partie `"metabase-server": { ... }` dans l'objet `mcpServers` existant.

Exemple avec un serveur existant:
```json
{
  "mcpServers": {
    "existing-server": {
      "command": "existing-command"
    },
    "metabase-server": {
      "command": "metabase-server",
      "env": {
        "METABASE_URL": "...",
        "METABASE_API_KEY": "..."
      }
    }
  }
}
```

### 4. Sauvegardez le fichier

- nano: `Ctrl+X`, puis `Y`, puis `Entrée`
- Notepad: `Fichier` → `Enregistrer`

## Étape 4: Redémarrer Claude Desktop

1. Quittez complètement Claude Desktop
2. Relancez Claude Desktop
3. Le serveur Metabase sera maintenant disponible!

## Vérification

Dans Claude Desktop, vous pouvez demander:

```
"Peux-tu créer une carte Metabase avec cette requête SQL: SELECT * FROM users LIMIT 10"
```

Avec le mode `nodata`, Claude pourra créer la carte mais ne pourra PAS l'exécuter pour voir les données.

## Dépannage

### "metabase-server: command not found"

Le `npm link` a échoué. Essayez:

```bash
# macOS/Linux
sudo npm link

# Windows (PowerShell en tant qu'Admin)
npm link
```

### "Cannot find module '@modelcontextprotocol/sdk'"

Les dépendances ne sont pas installées:

```bash
npm install
npm run build
npm link
```

### Claude Desktop ne voit pas le serveur

1. Vérifiez que le JSON est valide (pas de virgules manquantes/en trop)
2. Vérifiez le chemin du fichier de configuration
3. Redémarrez complètement Claude Desktop
4. Regardez les logs de Claude Desktop

### "Invalid API Key" dans les logs

Vérifiez que votre `METABASE_API_KEY` est correcte dans le fichier de configuration.

## Résumé Rapide

```bash
# 1. Installer
./install.sh

# 2. Configurer (mode sécurisé sans données)
npm run config:quick -- nodata https://VOTRE_URL VOTRE_CLÉ

# 3. Copier le JSON dans:
# macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
# Windows: %APPDATA%\Claude\claude_desktop_config.json
# Linux: ~/.config/Claude/claude_desktop_config.json

# 4. Redémarrer Claude Desktop
```

## Besoin d'aide?

- Documentation complète: [README.md](./README.md)
- Guide de démarrage rapide: [QUICK_START.md](./QUICK_START.md)
- Générateur de config: [CONFIG_GENERATOR.md](./CONFIG_GENERATOR.md)
- Ouvrir une issue: https://github.com/imlewc/metabase-server/issues
