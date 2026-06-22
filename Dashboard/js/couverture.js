/* Couverture transport calculée côté client, réactive aux modes sélectionnés.
   Même méthode que le calcul Gold (grille 100 m, rayon 300 m) : on échantillonne
   l'intérieur de chaque arrondissement et on compte la part des points à moins de
   300 m d'un arrêt d'un mode visible. */

import { etat } from "./config.js";

const RAYON_M = 300;
const PAS_M = 100;
const M_LAT = 111320; // mètres par degré de latitude

function pointDansAnneau(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        if (((yi > lat) !== (yj > lat)) &&
            (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

function anneaux(geom) {
    if (!geom) return [];
    if (geom.type === "Polygon") return geom.coordinates.length ? [geom.coordinates[0]] : [];
    if (geom.type === "MultiPolygon") return geom.coordinates.filter((p) => p.length).map((p) => p[0]);
    return [];
}

// Grille de points intérieurs d'un arrondissement — calculée une seule fois puis mise en cache.
function grilleInterieure(code) {
    if (!etat.grilleCouv) etat.grilleCouv = {};
    if (etat.grilleCouv[code]) return etat.grilleCouv[code];

    const feature = etat.GEO.features.find((f) => f.properties.code_arrondissement === code);
    const rings = feature ? anneaux(feature.geometry) : [];
    const pts = [];

    if (rings.length) {
        let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
        for (const r of rings) for (const [lo, la] of r) {
            if (lo < minx) minx = lo;
            if (lo > maxx) maxx = lo;
            if (la < miny) miny = la;
            if (la > maxy) maxy = la;
        }
        const mLon = M_LAT * Math.cos(((miny + maxy) / 2) * Math.PI / 180);
        const pasLat = PAS_M / M_LAT;
        const pasLon = PAS_M / mLon;
        for (let lat = miny; lat <= maxy; lat += pasLat) {
            for (let lon = minx; lon <= maxx; lon += pasLon) {
                if (rings.some((r) => pointDansAnneau(lon, lat, r))) pts.push([lon, lat]);
            }
        }
    }
    etat.grilleCouv[code] = pts;
    return pts;
}

// Calcule la couverture (% à <300 m) par arrondissement pour les modes cochés.
// Stocke le résultat dans etat.couvertureMode. Renvoie false si pas de données
// (la choroplèthe retombe alors sur la valeur Gold tous modes).
export function recalculerCouvertureTransport() {
    if (!etat.transportData || !etat.GEO) {
        etat.couvertureMode = null;
        return false;
    }

    const visibles = etat.catVisibleTransport || {};
    const arrets = etat.transportData.filter((p) =>
        p.lon != null && p.lat != null &&
        visibles[(p.mode || "bus").toLowerCase()] !== false
    );

    const r2 = RAYON_M * RAYON_M;
    const res = {};

    for (const feature of etat.GEO.features) {
        const code = feature.properties.code_arrondissement;
        const grille = grilleInterieure(code);
        if (!grille.length) { res[code] = 0; continue; }

        // bbox de la grille élargie du rayon → pré-filtre des arrêts (inclut les voisins proches)
        let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
        for (const [lo, la] of grille) {
            if (lo < minx) minx = lo;
            if (lo > maxx) maxx = lo;
            if (la < miny) miny = la;
            if (la > maxy) maxy = la;
        }
        const mLon = M_LAT * Math.cos(((miny + maxy) / 2) * Math.PI / 180);
        const margeLat = RAYON_M / M_LAT;
        const margeLon = RAYON_M / mLon;
        const proches = arrets.filter((p) =>
            p.lon >= minx - margeLon && p.lon <= maxx + margeLon &&
            p.lat >= miny - margeLat && p.lat <= maxy + margeLat
        );

        let couverts = 0;
        for (const [lon, lat] of grille) {
            const mLonPt = M_LAT * Math.cos(lat * Math.PI / 180);
            for (const p of proches) {
                const dx = (p.lon - lon) * mLonPt;
                const dy = (p.lat - lat) * M_LAT;
                if (dx * dx + dy * dy <= r2) { couverts++; break; }
            }
        }
        res[code] = Math.round((1000 * couverts) / grille.length) / 10;
    }

    etat.couvertureMode = res;
    return true;
}
