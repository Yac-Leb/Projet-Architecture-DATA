# Urban Data Explorer — Paris

Projet scolaire de **Data Engineering / Architecture de données**.

Un pipeline de données qui collecte, nettoie et agrège des données ouvertes sur les **20 arrondissements de Paris**, afin de les comparer sur des indicateurs de **logement, d'économie et de territoire**.

L'architecture suit le modèle **médaillon** : `Bronze (brut) → Silver (nettoyé) → Gold (agrégé)`, exposé via une **API REST** et visualisé dans un **dashboard interactif**.

---

## Architecture

```
Sources open data (DVF, INSEE, IDFM, Open Data Paris…)
        │   get_*.py
        ▼
┌───────────────────────┐   ┌───────────────────────────────────┐
│  PostgreSQL — bronze  │ + │  MongoDB — GeoJSON brut            │   ← brut, sans transformation
└───────────────────────┘   │  (arrondissements, espaces verts)  │
        │   Clean_*.py      └───────────────────────────────────┘
        ▼
┌───────────────────────┐   ┌───────────────────────────────────┐
│  PostgreSQL — silver  │ + │  MongoDB — GeoJSON nettoyé         │   ← nettoyé (aucun calcul)
└───────────────────────┘   └───────────────────────────────────┘
        │   Gold_*.py
        ▼
┌───────────────────────┐
│  PostgreSQL — gold    │                                             ← indicateurs agrégés
└───────────────────────┘
        │
        ▼
  API FastAPI (port 8000) → Dashboard MapLibre GL (port 8050)
```

| Couche | Rôle | Règle |
|--------|------|-------|
| **Bronze** | Stocker les données brutes | Aucun filtre, aucune transformation |
| **Silver** | Nettoyer | Valeurs aberrantes, formats, filtres Paris — **aucun calcul** |
| **Gold** | Calculer les indicateurs | Agrégations par arrondissement, prêtes à l'analyse |

---

## Stack technique

- **Python** (pandas, SQLAlchemy, PyMongo, requests)
- **PostgreSQL** — schémas `bronze`, `silver`, `gold`
- **MongoDB** — GeoJSON des arrondissements + polygones espaces verts frais
- **FastAPI** — API REST exposant les indicateurs (port 8000)
- **MapLibre GL JS 4.7.1** — dashboard web : carte interactive (port 8050), modules ES natifs (sans bundler)
- **Chart.js** — graphiques du mode comparaison
- **Docker / Docker Compose** — orchestration de tous les services
- **Adminer** & **Mongo Express** — interfaces d'administration des bases

---

## Prérequis

- **Docker** et **Docker Compose** installés.
- Aucune installation Python locale n'est nécessaire : tout s'exécute dans des conteneurs.

---

## Installation et lancement

### 1. Construire l'image de l'application Python

A faire au premier lancement, et après toute modification de `requirements.txt` ou du `Dockerfile` :

```bash
docker compose build
```

> En cas d'erreur `No module named …`, forcer la reconstruction complète : `docker compose build --no-cache`

### 2. Démarrer tous les services

```bash
docker compose up -d
```

Démarre : PostgreSQL, MongoDB, `python_app`, l'**API** (port 8000), le **dashboard** (port 8050), Adminer et Mongo Express.

### 3. Exécuter les pipelines dans l'ordre

Chaque couche lit la précédente : respecter l'ordre **Bronze → Silver → Gold**.

```bash
# Bronze : télécharge les sources et les charge brutes en base
docker exec -it python_app python /app/Stockage/main.py

# Silver : nettoie les tables (valeurs aberrantes, formats, filtres Paris)
docker exec -it python_app python /app/Silver/main.py

# Gold : calcule les indicateurs agrégés par arrondissement
docker exec -it python_app python /app/Gold/main.py
```

> Chaque orchestrateur affiche les scripts exécutés et signale ceux qui échouent.

> **Attention :** les bases PostgreSQL et MongoDB n'ont pas de volume persistant. Les données sont perdues si les conteneurs sont recréés (redémarrage Docker Desktop, `docker compose down`). Il faut relancer les trois pipelines après chaque recréation.

### 4. Ouvrir le dashboard

Une fois les pipelines exécutés, la carte interactive est disponible sur **http://localhost:8050** (et l'API sur **http://localhost:8000/docs**).

---

## Vérifier les résultats

### En ligne de commande

```bash
# Lister les tables de chaque couche
docker exec -it postgres_db psql -U admin -d urban_db -c "\dt bronze.*"
docker exec -it postgres_db psql -U admin -d urban_db -c "\dt silver.*"
docker exec -it postgres_db psql -U admin -d urban_db -c "\dt gold.*"

# Aperçu d'un indicateur
docker exec -it postgres_db psql -U admin -d urban_db -c "SELECT * FROM gold.prix_m2 LIMIT 5;"

# MongoDB : arrondissements et espaces verts
docker exec -it mongo_db mongosh --eval "db.getSiblingDB('urban_db').arrondissements.countDocuments()"
docker exec -it mongo_db mongosh --eval "db.getSiblingDB('urban_db').espaces_verts_geo.countDocuments()"
```

### Via les interfaces web

| Interface | URL | Connexion |
|-----------|-----|-----------|
| **Dashboard** (carte interactive) | http://localhost:8050 | — |
| **API FastAPI** (Swagger) | http://localhost:8000/docs | — |
| **Adminer** (PostgreSQL) | http://localhost:8080 | serveur `postgres` · utilisateur `admin` · mot de passe `admin` · base `urban_db` |
| **Mongo Express** (MongoDB) | http://localhost:8081 | utilisateur `admin` · mot de passe `pass` |

---

## API REST (FastAPI)

L'API expose les indicateurs de la couche `gold` et les géométries MongoDB. Elle démarre automatiquement avec `docker compose up -d` (service `api`, port **8000**).

**Documentation interactive (Swagger) :** http://localhost:8000/docs

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/` | Informations et liste des ressources |
| `GET` | `/indicateurs` | Liste des 10 indicateurs disponibles |
| `GET` | `/indicateurs/{nom}` | Données d'un indicateur (ex. `prix_m2`, `fraicheur`…) |
| `GET` | `/indicateurs/{nom}?arrondissement=1` | Filtré sur un arrondissement (1 à 20) |
| `GET` | `/dashboard` | Toutes les tables gold pré-groupées par arrondissement (1 appel au lieu de 10) |
| `GET` | `/arrondissements` | Arrondissements au format GeoJSON (géométries MongoDB) |
| `GET` | `/espaces_verts_geo` | Polygones GeoJSON des espaces verts frais (MongoDB) |
| `GET` | `/fontaines` | Points des fontaines à boire (lat/lon + détails) |
| `GET` | `/fraicheur_points` | Points de fraîcheur (4 sources : fontaines, espaces verts, équipements, commerces eau) |
| `GET` | `/marches_points` | 80 marchés alimentaires (lat/lon + nom, jours, produit) |
| `GET` | `/transport_points` | 3 435 arrêts de transport (lat/lon + nom, mode) ; filtres `?arrondissement=N` et `?mode=metro\|bus\|tram\|rer` |
| `GET` | `/docs` | Swagger UI auto-généré |

**Exemples :**

```bash
# Prix au m² de l'arrondissement 1
curl "http://localhost:8000/indicateurs/prix_m2?arrondissement=1"

# Toutes les données gold en un appel
curl "http://localhost:8000/dashboard"

# Polygones des espaces verts frais
curl "http://localhost:8000/espaces_verts_geo"
```

---

## Dashboard — carte interactive

Un dashboard web consomme l'API et affiche une **carte choroplèthe interactive des 20 arrondissements**. Il démarre avec `docker compose up -d` (service `dashboard`, nginx, port 8050).

**Accès : http://localhost:8050**

Un simple **F5** suffit après modification des fichiers JS/CSS : nginx est configuré (`Dashboard/nginx.conf`) avec `Cache-Control: no-cache`, le navigateur revalide donc à chaque chargement.

### Fonctionnalités

**Vue Carte**
- **Choroplèthe** colorée par l'indicateur sélectionné (7 choix : prix/m², logements sociaux, accessibilité, fraîcheur, transport, marchés, tension) avec légende dynamique. **Code couleur orienté par le sens de l'indicateur** : vert = bon pour l'habitant, rouge = mauvais (ex. prix bas = vert, couverture transport élevée = vert). La fraîcheur garde son propre dégradé vert.
- **Timeline** : curseur d'année (2021 → 2024) qui met à jour la carte et le panneau de détail pour les **indicateurs temporels** (drapeau `parAnnee`) : prix médian au m², logements sociaux financés (flux annuel) et part de logements sociaux (parc cumulé). Les autres indicateurs (fraîcheur, transport, marchés, accessibilité, tension) ne dépendent pas de l'année.
- **Clic sur un arrondissement** : popup épinglé sur la carte + panneau détail complet à droite (KPI, sparklines, rangs).
- **Fraîcheur urbaine** : affiche les espaces verts frais sous forme de **polygones** dont la teinte varie par lieu (gradient vert clair → foncé selon `proportion_vegetation_haute`, le % de végétation haute >8 m de chaque espace) ; clic = nom + % de canopée. GeoJSON depuis `/espaces_verts_geo`.
- **Toggle Fontaines & eau** : ~1 300 fontaines à boire + commerces eau (filtrables par catégorie).
- **Toggle Marchés alimentaires** : 80 marchés (popup avec nom, jours et type de produits).
- **Transport — couverture piétonne** : l'indicateur « Couverture transport (<300 m) » colore chaque arrondissement par le **% de sa surface située à moins de 300 m d'un arrêt** (norme d'accessibilité urbaine), bien plus parlant que le comptage brut (insensible à la taille). **Réactif aux modes** : avec le toggle Transport actif, cocher/décocher Métro / RER / Bus / Tram recalcule la couverture pour les modes retenus (calcul à la volée côté client).
- **Toggle Transport** : 3 435 arrêts filtrables par mode (métro, RER, bus, tram) avec légende colorée.

**Vue Comparaison**
- Deux arrondissements côte à côte : tableau de tous les indicateurs + graphique d'évolution du prix (Line) + graphique des indicateurs composites (Bar).

### Architecture front-end

```
Dashboard/
├── index.html          ← onglets Carte / Comparaison ; charge js/app.js en type="module"
├── style.css
├── nginx.conf          ← config nginx : Cache-Control no-cache (revalidation à chaque F5)
└── js/                 ← modules ES natifs (import/export, sans bundler)
    ├── config.js       ← constantes (RAMPE, COULEURS_*…) + objet etat partagé
    ├── utils.js        ← fonctions pures + INDICATEURS_CARTE (avec sens vertSiHaut)
    ├── carte.js        ← initCarte(), choroplèthe (rampe orientée vert=bon), polygones fraîcheur, légende
    ├── couverture.js   ← couverture transport <300 m calculée côté client, réactive aux modes
    ├── couches.js      ← toggles fontaines / marchés / transport
    ├── detail.js       ← setArrActif(), panneau KPI, sparklines
    ├── comparaison.js  ← tableau + graphiques Chart.js
    └── app.js          ← point d'entrée : 2 fetch (/arrondissements + /dashboard), initInterface()
```

---

## Indicateurs (schéma `gold`)

Chaque indicateur est une table agrégée par `code_arrondissement` (1 à 20).

**Indicateurs obligatoires**

| Table | Contenu |
|-------|---------|
| `gold.prix_m2` | Prix médian au m² par année + évolution annuelle |
| `gold.types_logements` | Répartition appartements / maisons (nombre, surface, part %) |
| `gold.pieces` | Répartition par nombre de pièces (Studio/T1, T2, T3, T4+) |
| `gold.accessibilite` | Accessibilité prix vs revenus (m² achetables par an de revenu) |
| `gold.logements_sociaux` | Logements sociaux financés par année + cumul (grille complète 20 arr × années, 0 si aucune opération) |
| `gold.logements_sociaux_part` | Part des logements sociaux par année (parc cumulé / ménages NBMEN19 figé) |

**Indicateurs composites**

| Table | Contenu |
|-------|---------|
| `gold.fraicheur` | Comptage des ressources de fraîcheur par arrondissement (4 sources) |
| `gold.transport` | Arrêts par mode (métro, bus, tram, RER…) + **couverture piétonne** `couverture_300m_pct` (% de surface à <300 m d'un arrêt) |
| `gold.marches` | Nombre de marchés alimentaires + jours de tenue |
| `gold.tension` | Tension immobilière (rendement locatif, durée d'amortissement) |

**Tables de points individuels (carte)**

| Table | Contenu |
|-------|---------|
| `gold.fontaines` | 1 327 fontaines à boire (lat/lon + type, modèle, adresse, disponibilité) |
| `gold.fraicheur_points` | 4 360 points de fraîcheur (4 sources, lat/lon + source) |
| `gold.marches_points` | 80 marchés (lat/lon + nom, jours, produit, arrondissement) |
| `gold.transport_points` | 3 435 arrêts (lat/lon + nom, mode normalisé, arrondissement) |

**GeoJSON MongoDB**

| Collection | Contenu |
|-----------|---------|
| `arrondissements` | Polygones GeoJSON des 20 arrondissements (Silver) |
| `espaces_verts_geo` | Polygones GeoJSON des espaces verts frais (Silver) |

---

## Arrêter le projet

```bash
docker compose down        # arrête et supprime les conteneurs
docker compose down -v     # idem + supprime les volumes
```

> Après `docker compose down`, les données en base sont perdues (pas de volume persistant). Relancer les pipelines Bronze → Silver → Gold au prochain démarrage.

---

## Structure du projet

```
.
├── Stockage/                    # Couche BRONZE
│   ├── main.py                  #   orchestrateur (get_*.py)
│   └── traitement/
│       ├── db_connection.py     #   connexions partagées (PostgreSQL / MongoDB)
│       ├── get_dvf.py           #   → bronze.dvf_raw (335k transactions DVF 2021–2024)
│       ├── get_loyers.py        #   → bronze.loyers_raw
│       ├── get_Pop_insee.py     #   → bronze.population_raw
│       ├── get_Logement_sociaux.py  # → bronze.logements_sociaux_raw
│       ├── get_arrondissement.py    # → MongoDB bronze_arrondissements
│       ├── get_fraicheur.py     #   → 4 tables bronze CSV + MongoDB bronze_espaces_verts_geo
│       ├── get_transport.py     #   → bronze.arrets_lignes_raw (IDFM)
│       ├── get_marches.py       #   → bronze.marches_raw
│       └── get_revenus.py       #   → bronze.revenus_raw (FiLoSoFi INSEE)
├── Silver/                      # Couche SILVER
│   ├── main.py                  #   orchestrateur (Clean_*.py)
│   └── traitement/
│       ├── Clean_dvf.py         #   → silver.dvf
│       ├── Clean_Loyer.py       #   → silver.loyers
│       ├── Clean_Population.py  #   → silver.population
│       ├── Clean_Logement_social.py # → silver.logements_sociaux
│       ├── Clean_Revenus.py     #   → silver.revenus
│       ├── Clean_arrondissement.py  # → MongoDB arrondissements
│       ├── Clean_fraicheur.py   #   → 4 tables silver CSV + MongoDB espaces_verts_geo
│       ├── Clean_transport.py   #   → silver.transport
│       └── Clean_marches.py     #   → silver.marches
├── Gold/                        # Couche GOLD
│   ├── main.py                  #   orchestrateur (Gold_*.py)
│   └── traitement/
│       ├── gold_utils.py        #   connexions, arr_from_code5(), point-in-polygon Python
│       └── Gold_*.py            #   14 scripts → 10 tables agrégées + 4 tables de points
├── api/
│   └── main.py                  # API FastAPI (endpoints gold + MongoDB)
├── Dashboard/                   # Front-end (MapLibre GL, nginx port 8050)
│   ├── index.html
│   ├── style.css
│   ├── nginx.conf               # Cache-Control no-cache
│   └── js/                      # 8 modules ES natifs
│       ├── config.js
│       ├── utils.js
│       ├── carte.js
│       ├── couverture.js        # couverture transport <300 m (client, par mode)
│       ├── couches.js
│       ├── detail.js
│       ├── comparaison.js
│       └── app.js
├── docker-compose.yml
├── dockerfile
└── requirements.txt
```
