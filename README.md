# 🏙️ Urban Data Explorer — Paris

Projet scolaire de **Data Engineering / Architecture de données**.

Un pipeline de données qui collecte, nettoie et agrège des données ouvertes sur les
**20 arrondissements de Paris**, afin de les comparer sur des indicateurs de
**logement, d'économie et de territoire**.

L'architecture suit le modèle **médaillon** : `Bronze (brut) → Silver (nettoyé) → Gold (agrégé)`.

---

## 🧱 Architecture

```
Sources open data (DVF, INSEE, IDFM, Open Data Paris...)
        │   get_*.py
        ▼
┌───────────────────────┐   ┌────────────────────┐
│  PostgreSQL — bronze  │ + │  MongoDB — GeoJSON  │   ← données brutes, sans transformation
└───────────────────────┘   └────────────────────┘
        │   Clean_*.py
        ▼
┌───────────────────────┐
│  PostgreSQL — silver  │                            ← données nettoyées (aucun calcul)
└───────────────────────┘
        │   Gold_*.py
        ▼
┌───────────────────────┐
│  PostgreSQL — gold    │                            ← indicateurs agrégés par arrondissement
└───────────────────────┘
```

| Couche | Rôle | Règle |
|--------|------|-------|
| **Bronze** | Stocker les données brutes | Aucun filtre, aucune transformation |
| **Silver** | Nettoyer | Valeurs aberrantes, formats, filtres Paris — **aucun calcul** |
| **Gold** | Calculer les indicateurs | Agrégations par arrondissement, prêtes à l'analyse |

---

## ⚙️ Stack technique

- **Python** (pandas, SQLAlchemy, PyMongo, requests)
- **PostgreSQL** — schémas `bronze`, `silver`, `gold`
- **MongoDB** — géométries GeoJSON des arrondissements
- **FastAPI** — API REST exposant les indicateurs (port 8000)
- **Docker / Docker Compose** — orchestration de tous les services
- **Adminer** & **Mongo Express** — interfaces d'administration des bases

---

## 📦 Prérequis

- **Docker** et **Docker Compose** installés.
- Aucune installation Python locale n'est nécessaire : tout s'exécute dans des conteneurs.

---

## 🚀 Installation et lancement

### 1. Construire l'image de l'application Python

À faire au premier lancement, et après toute modification de `requirements.txt` ou du `Dockerfile` :

```bash
docker compose build python_app
```

### 2. Démarrer tous les services

```bash
docker compose up -d
```

Démarre : PostgreSQL, MongoDB, le conteneur `python_app`, Adminer et Mongo Express.

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

> 💡 Chaque orchestrateur affiche les scripts exécutés et signale ceux qui échouent.

---

## 🔍 Vérifier les résultats

### En ligne de commande

```bash
# Lister les tables de chaque couche
docker exec -it postgres_db psql -U admin -d urban_db -c "\dt bronze.*"
docker exec -it postgres_db psql -U admin -d urban_db -c "\dt silver.*"
docker exec -it postgres_db psql -U admin -d urban_db -c "\dt gold.*"

# Aperçu d'un indicateur
docker exec -it postgres_db psql -U admin -d urban_db -c "SELECT * FROM gold.prix_m2 LIMIT 5;"

# MongoDB : nombre d'arrondissements (GeoJSON)
docker exec -it mongo_db mongosh --eval "db.getSiblingDB('urban_db').arrondissements.countDocuments()"
```

### Via les interfaces web

| Interface | URL | Connexion |
|-----------|-----|-----------|
| **Adminer** (PostgreSQL) | http://localhost:8080 | serveur `postgres` · utilisateur `admin` · mot de passe `admin` · base `urban_db` |
| **Mongo Express** (MongoDB) | http://localhost:8081 | utilisateur `admin` · mot de passe `pass` |

Dans Adminer, sélectionne la base `urban_db` puis explore les schémas `bronze`, `silver`, `gold`.

---

## 🔌 API REST (FastAPI)

Une API expose les indicateurs de la couche `gold`. Elle démarre automatiquement avec
`docker compose up -d` (service `api`, port **8000**).

**Documentation interactive (Swagger) :** http://localhost:8000/docs

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/` | Informations et liste des ressources |
| `GET` | `/indicateurs` | Liste des 8 indicateurs disponibles |
| `GET` | `/indicateurs/{nom}` | Données d'un indicateur (ex. `prix_m2`, `fraicheur`...) |
| `GET` | `/indicateurs/{nom}?arrondissement=1` | Filtré sur un arrondissement (1 à 20) |
| `GET` | `/arrondissements` | Arrondissements au format GeoJSON |

**Exemples :**

```bash
# Prix au m² de l'arrondissement 1
curl "http://localhost:8000/indicateurs/prix_m2?arrondissement=1"

# Fraîcheur urbaine (tous les arrondissements)
curl "http://localhost:8000/indicateurs/fraicheur"

# Géométries des arrondissements (GeoJSON)
curl "http://localhost:8000/arrondissements"
```

> L'API doit être interrogée **après** avoir exécuté les pipelines (les tables `gold` doivent exister).

---

## 📊 Indicateurs (schéma `gold`)

Chaque indicateur est une table agrégée par `code_arrondissement` (1 à 20).

**Indicateurs obligatoires**

| Table | Contenu |
|-------|---------|
| `gold.prix_m2` | Prix médian au m² par année + évolution annuelle |
| `gold.types_logements` | Répartition appartements / maisons (nombre, surface, part %) |
| `gold.accessibilite` | Accessibilité prix vs revenus (m² achetables par an de revenu) |
| `gold.logements_sociaux` | Logements sociaux financés par année + cumul |

**Indicateurs composites**

| Table | Contenu |
|-------|---------|
| `gold.fraicheur` | Ressources de fraîcheur (fontaines, espaces verts, équipements, commerces eau) |
| `gold.transport` | Arrêts de transport par mode (métro, bus, tram, RER...) |
| `gold.marches` | Nombre de marchés alimentaires + jours de tenue |
| `gold.tension` | Tension immobilière (rendement locatif, durée d'amortissement) |

---

## 🛑 Arrêter le projet

```bash
docker compose down        # arrête et supprime les conteneurs (les données sont conservées)
docker compose down -v     # idem + supprime les volumes (efface toutes les données)
```

---

## 🗂️ Structure du projet

```
.
├── Stockage/                 # Couche BRONZE
│   ├── main.py               #   orchestrateur des get_*.py
│   └── traitement/
│       ├── db_connection.py  #   connexions partagées (PostgreSQL / MongoDB)
│       └── get_*.py          #   téléchargement des sources -> bronze
├── Silver/                   # Couche SILVER
│   ├── main.py               #   orchestrateur des Clean_*.py
│   └── traitement/
│       └── Clean_*.py        #   nettoyage bronze -> silver
├── Gold/                     # Couche GOLD
│   ├── main.py               #   orchestrateur des Gold_*.py
│   └── traitement/
│       ├── gold_utils.py     #   utilitaires (connexions, géométrie)
│       └── Gold_*.py         #   calcul des indicateurs silver -> gold
├── api/                      # API REST
│   └── main.py               #   FastAPI : endpoints des indicateurs gold
├── docker-compose.yml        # Définition des services
├── dockerfile                # Image python_app
└── requirements.txt          # Dépendances Python
```
