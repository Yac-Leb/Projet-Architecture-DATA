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
- **Leaflet** — dashboard web : carte de Paris interactive (port 8050)
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

Démarre tous les services : PostgreSQL, MongoDB, `python_app`, l'**API** (port 8000),
le **dashboard** (port 8050), Adminer et Mongo Express.

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

### 4. Ouvrir le dashboard

Une fois les pipelines exécutés, la carte interactive est disponible sur **http://localhost:8050**
(et l'API sur **http://localhost:8000/docs**).

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
| **Dashboard** (carte interactive) | http://localhost:8050 | — |
| **API FastAPI** (Swagger) | http://localhost:8000/docs | — |
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
| `GET` | `/indicateurs` | Liste des 10 indicateurs disponibles |
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

## 🗺️ Dashboard — carte interactive

Un dashboard web (Leaflet, sans build) consomme l'API et affiche une **carte choroplèthe
interactive des 20 arrondissements**. Il démarre avec `docker compose up -d` (service `dashboard`).

**Accès : http://localhost:8050**

Fonctionnalités :
- **Carte choroplèthe** colorée par un indicateur choisi dans un menu déroulant (prix/m², part de
  logements sociaux, accessibilité, fraîcheur, transport, marchés, tension) + légende dynamique.
- **Cartes KPI** (à droite) : prix médian, part de logements sociaux, accessibilité, tension de
  l'arrondissement sélectionné, avec badge d'évolution annuelle.
- **Timeline** : curseur d'année (2021→2024) qui met à jour la carte et les KPI du prix.
- **Distribution résidentielle** (en bas) : répartition par nombre de pièces (Studio/T1, T2, T3, T4+).
- **Survol** → infobulle (nom + prix + évolution) ; **clic** → sélectionne l'arrondissement.
- **Calque Fontaines à boire** : case à cocher qui affiche les ~1 300 fontaines de Paris ; clic sur
  une fontaine → détails (type, modèle, adresse, en service ou non).
- **Mode Comparaison** : deux arrondissements côte à côte (tableau + graphiques d'évolution
  du prix et des indicateurs composites).

> Le dashboard appelle l'API sur `http://localhost:8000` ; les deux doivent tourner.

---

## 📊 Indicateurs (schéma `gold`)

Chaque indicateur est une table agrégée par `code_arrondissement` (1 à 20).

**Indicateurs obligatoires**

| Table | Contenu |
|-------|---------|
| `gold.prix_m2` | Prix médian au m² par année + évolution annuelle |
| `gold.types_logements` | Répartition appartements / maisons (nombre, surface, part %) |
| `gold.pieces` | Répartition par nombre de pièces (Studio/T1, T2, T3, T4+) |
| `gold.accessibilite` | Accessibilité prix vs revenus (m² achetables par an de revenu) |
| `gold.logements_sociaux` | Logements sociaux financés par année + cumul |
| `gold.logements_sociaux_part` | Part des logements sociaux (% des ménages) |

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
├── Dashboard/                # Front-end (Leaflet, servi par nginx)
│   ├── index.html            #   structure (onglets Carte / Comparaison)
│   ├── style.css             #   mise en page
│   └── app.js                #   carte choroplèthe + interactions + comparaison
├── docker-compose.yml        # Définition des services
├── dockerfile                # Image python_app
└── requirements.txt          # Dépendances Python
```
