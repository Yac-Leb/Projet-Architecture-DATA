"""API REST (FastAPI) exposant les indicateurs de la couche Gold.

Réutilise db_connection.py du projet pour se connecter à PostgreSQL (schéma gold)
et à MongoDB (géométries des arrondissements).
Documentation interactive : http://localhost:8000/docs
"""
import os
import sys

sys.path.append(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "../Stockage/traitement")
)

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from db_connection import get_postgres_engine, get_mongo_client

app = FastAPI(
    title="Urban Data Explorer — API",
    description="Indicateurs des 20 arrondissements de Paris (couche Gold).",
    version="1.0.0",
)

# Autorise un futur front-end (dashboard) à appeler l'API depuis le navigateur.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = get_postgres_engine()

# Tables d'indicateurs disponibles dans le schéma gold.
INDICATEURS = {
    "prix_m2": "Prix médian au m² par année + évolution",
    "types_logements": "Répartition appartements / maisons",
    "accessibilite": "Accessibilité prix vs revenus",
    "logements_sociaux": "Logements sociaux financés par année + cumul",
    "fraicheur": "Ressources de fraîcheur urbaine",
    "transport": "Arrêts de transport par mode",
    "marches": "Marchés alimentaires",
    "tension": "Tension immobilière",
}


def lire_table(table: str, arrondissement: int | None = None) -> list[dict]:
    """Lit une table gold et renvoie une liste de dictionnaires JSON-compatibles."""
    requete = f"SELECT * FROM gold.{table}"
    params = {}
    if arrondissement is not None:
        requete += " WHERE code_arrondissement = %(arr)s"
        params = {"arr": arrondissement}
    df = pd.read_sql(requete, engine, params=params)
    # Remplace NaN/inf par None (JSON valide)
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.astype(object).where(pd.notnull(df), None)
    return df.to_dict(orient="records")


@app.get("/", tags=["Général"])
def racine():
    """Point d'entrée : liste les ressources disponibles."""
    return {
        "message": "API Urban Data Explorer — arrondissements de Paris",
        "documentation": "/docs",
        "indicateurs": list(INDICATEURS.keys()),
        "geo": "/arrondissements",
    }


@app.get("/indicateurs", tags=["Général"])
def liste_indicateurs():
    """Liste les indicateurs disponibles avec leur description."""
    return INDICATEURS


@app.get("/indicateurs/{nom}", tags=["Indicateurs"])
def indicateur(
    nom: str,
    arrondissement: int | None = Query(
        None, ge=1, le=20, description="Filtrer sur un arrondissement (1 à 20)"
    ),
):
    """Renvoie les données d'un indicateur, éventuellement filtrées par arrondissement."""
    if nom not in INDICATEURS:
        raise HTTPException(
            status_code=404,
            detail=f"Indicateur inconnu : '{nom}'. Disponibles : {list(INDICATEURS)}",
        )
    return lire_table(nom, arrondissement)


@app.get("/arrondissements", tags=["Géographie"])
def arrondissements():
    """Renvoie les arrondissements au format GeoJSON (géométrie depuis MongoDB)."""
    client = get_mongo_client()
    mongo = client["urban_db"]
    features = []
    for f in mongo["arrondissements"].find({}, {"_id": 0}):
        features.append(
            {
                "type": "Feature",
                "geometry": f.get("geometry"),
                "properties": f.get("properties", {}),
            }
        )
    if not features:
        raise HTTPException(
            status_code=404,
            detail="Aucun arrondissement en base. Lancer d'abord les pipelines.",
        )
    return {"type": "FeatureCollection", "features": features}
