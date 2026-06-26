/* Carte MapLibre GL : initialisation, choroplèthe, légende et cluster fraîcheur. */

import { etat, API, RAMPE } from "./config.js";
import {
    INDICATEURS_CARTE, toutesValeurs,
    ajouterCurseur, creerPopupPoint, fetchCouche,
} from "./utils.js";
import { setArrActif, tooltipHTML } from "./detail.js";
import { recalculerCouvertureTransport } from "./couverture.js";

// ---------- Initialisation ----------

export function initCarte() {
    etat.map = new maplibregl.Map({
        container: "map",
        style:     "https://tiles.openfreemap.org/styles/liberty",
        center:    [2.345, 48.857],
        zoom:      11.3,
        minZoom:   10,
        maxZoom:   19,
    });

    etat.map.addControl(
        new maplibregl.NavigationControl({ showCompass: true }),
        "top-right"
    );

    etat.popupHover = new maplibregl.Popup({
        closeButton:  true,
        closeOnClick: false,
        closeOnMove:  false,
        className:    "arr-tooltip-wrap",
        offset:       14,
        maxWidth:     "none",
    });

    etat.map.on("load", () => {
        ajouterCouchesArr();
        etat.carteReady = true;
        etat.paliers = calculerPaliers();
        rafraichirCarte();
        setArrActif(etat.arrActif, false);
    });
}

// ---------- Couches arrondissements ----------

function ajouterCouchesArr() {
    etat.map.addSource("arr", {
        type:      "geojson",
        data:      etat.GEO,
        promoteId: "code_arrondissement",
    });

    etat.map.addLayer({
        id: "arr-fill", type: "fill", source: "arr",
        paint: {
            "fill-color":   ["coalesce", ["get", "_couleur"], "#cccccc"],
            "fill-opacity": ["case", ["==", ["get", "_actif"], 1], 0.72, 0.55],
        },
    });

    etat.map.addLayer({
        id: "arr-line", type: "line", source: "arr",
        paint: { "line-color": "#ffffff", "line-width": 1.4 },
    });

    etat.map.addLayer({
        id: "arr-line-active", type: "line", source: "arr",
        filter: ["==", ["get", "_actif"], 1],
        paint:  { "line-color": "#0f1b2d", "line-width": 3.5 },
    });

    ajouterCurseur("arr-fill");

    etat.map.on("click", "arr-fill", (evenement) => {
        if (!evenement.features.length) return;

        // Ne pas ouvrir le popup arrondissement si un point est cliqué par-dessus
        const couchesPts = ["transport-pt", "marches-pt", "fontaines-pt"]
            .filter((id) => !!etat.map.getLayer(id));

        if (couchesPts.length > 0) {
            const ptsSurClick = etat.map.queryRenderedFeatures(evenement.point, { layers: couchesPts });
            if (ptsSurClick.length > 0) return;
        }

        const code = evenement.features[0].properties.code_arrondissement;
        setArrActif(code, true);
        etat.popupHover
            .setLngLat(evenement.lngLat)
            .setHTML(tooltipHTML(code))
            .addTo(etat.map);
    });
}

// ---------- Couleurs choroplèthe ----------

export function calculerPaliers() {
    const cfg = INDICATEURS_CARTE[etat.indicateurCourant];

    // Indicateur temporel : seuils FIXES calculés sur toutes les années, pour que
    // la carte évolue visiblement dans le temps (sinon les quantiles par année
    // figent les couleurs quand le classement des arrondissements ne bouge pas).
    let valeurs;
    if (cfg?.parAnnee && etat.annees?.length > 1) {
        const anneeSauv = etat.anneeActive;
        valeurs = [];
        for (const an of etat.annees) {
            etat.anneeActive = an;
            valeurs.push(...toutesValeurs(cfg.valeur));
        }
        etat.anneeActive = anneeSauv;
    } else {
        valeurs = toutesValeurs(cfg.valeur);
    }

    valeurs.sort((a, b) => a - b);
    const seuils = [];
    for (let i = 1; i < RAMPE.length; i++) {
        seuils.push(valeurs[Math.floor((valeurs.length - 1) * (i / RAMPE.length))]);
    }
    return seuils;
}

// Rampe orientée selon le sens de l'indicateur : vertSiHaut → valeur haute en vert.
// RAMPE = [vert … rouge] ; inversée = [rouge … vert].
function rampeActive() {
    const cfg = INDICATEURS_CARTE[etat.indicateurCourant];
    return cfg?.vertSiHaut ? [...RAMPE].reverse() : RAMPE;
}

export function couleur(valeur) {
    if (valeur == null) return "#cccccc";
    const rampe = rampeActive();
    for (let i = 0; i < etat.paliers.length; i++) {
        if (valeur <= etat.paliers[i]) return rampe[i];
    }
    return rampe[rampe.length - 1];
}

// ---------- Rafraîchissement de la choroplèthe ----------

export function rafraichirCarte() {
    if (!etat.carteReady) return;

    const estFraicheur = etat.indicateurCourant === "fraicheur";
    majModeFraicheur(estFraicheur);
    // Couverture transport : recalcul selon les modes cochés avant de redéfinir les paliers
    if (etat.indicateurCourant === "transport") recalculerCouvertureTransport();
    if (!estFraicheur) etat.paliers = calculerPaliers();

    etat.GEO.features.forEach((feature) => {
        const code = feature.properties.code_arrondissement;
        const valeur = estFraicheur
            ? null
            : INDICATEURS_CARTE[etat.indicateurCourant].valeur(code);
        feature.properties._couleur = estFraicheur ? "rgba(0,0,0,0)" : couleur(valeur);
        feature.properties._actif  = code === etat.arrActif ? 1 : 0;
    });

    etat.map.getSource("arr").setData(etat.GEO);
    etat.map.setFilter("arr-line-active", ["==", ["get", "_actif"], 1]);
    majLegende();
}

// ---------- Légende ----------

function paliersHTML() {
    const rampe = rampeActive();

    // Nombre de décimales selon l'écart minimal entre seuils consécutifs
    let minGap = Infinity;
    for (let i = 1; i < etat.paliers.length; i++)
        minGap = Math.min(minGap, etat.paliers[i] - etat.paliers[i - 1]);
    const dec = minGap < 1 ? 1 : 0;
    const fmt = (v) => parseFloat(v.toFixed(dec)).toLocaleString("fr-FR");

    let html = "";
    let bas = -Infinity;
    for (let i = 0; i < rampe.length; i++) {
        const haut = i < etat.paliers.length ? etat.paliers[i] : Infinity;
        const etiq = haut === Infinity
            ? `> ${fmt(etat.paliers[etat.paliers.length - 1])}`
            : `${bas === -Infinity ? "≤" : fmt(bas) + "–"} ${fmt(haut)}`;
        html += `<div class="row" style="display:flex;align-items:center;gap:7px;margin:2px 0">
                     <span style="width:24px;height:11px;border-radius:3px;background:${rampe[i]}"></span>
                     ${etiq}
                 </div>`;
        bas = haut;
    }
    return html;
}


function majLegende() {
    const conteneur = document.getElementById("legende-map");
    if (!conteneur) return;

    const estFraicheur = etat.indicateurCourant === "fraicheur";
    const cfg = INDICATEURS_CARTE[etat.indicateurCourant];
    const titre = estFraicheur
        ? "Espaces verts frais"
        : cfg.label + (cfg.unite ? ` (${cfg.unite})` : "");

    const corpsFraicheur = `
        <div class="row" style="display:flex;align-items:center;gap:7px;margin:2px 0">
            <span style="width:60px;height:11px;border-radius:3px;
                  background:linear-gradient(to right,#c8e6c9,#1b5e20)"></span>
            <span style="font-size:11px">${Math.round(etat.fraicheurMin ?? 0)} – ${Math.round(etat.fraicheurMax ?? 100)} %</span>
        </div>
        <div style="font-size:10px;color:#666;margin-top:2px">Végétation haute (&gt; 8 m) par lieu</div>`;

    conteneur.innerHTML = `<div class="legende-titre">${titre}</div>
        ${estFraicheur ? corpsFraicheur : paliersHTML()}`;
    conteneur.classList.remove("hidden");
}

// ---------- Mode fraîcheur (polygones espaces verts) ----------

const LAYERS_FRAICHEUR = ["fraicheur-espaces-fill", "fraicheur-espaces-line"];

function majModeFraicheur(actif) {
    if (actif) {
        construireFraicheur();
    } else if (etat.fraicheurPrete) {
        LAYERS_FRAICHEUR.forEach((id) => etat.map.setLayoutProperty(id, "visibility", "none"));
    }
}

async function construireFraicheur() {
    if (etat.fraicheurPrete) {
        LAYERS_FRAICHEUR.forEach((id) => etat.map.setLayoutProperty(id, "visibility", "visible"));
        return;
    }

    const geo = await fetchCouche(`${API}/espaces_verts_geo`);
    if (!geo) return;

    // Calcul de fraîcheur PAR LIEU : proportion de végétation haute (>8 m), en %
    let fMin = Infinity, fMax = -Infinity;
    geo.features.forEach((f) => {
        const v = parseFloat(f.properties?.proportion_vegetation_haute);
        f.properties._fresh = Number.isFinite(v) ? v : null;
        if (f.properties._fresh != null) {
            fMin = Math.min(fMin, f.properties._fresh);
            fMax = Math.max(fMax, f.properties._fresh);
        }
    });
    if (!Number.isFinite(fMin)) { fMin = 0; fMax = 100; }   // garde-fou
    etat.fraicheurMin = fMin;
    etat.fraicheurMax = fMax;

    etat.map.addSource("fraicheur-espaces", { type: "geojson", data: geo });

    etat.map.addLayer({
        id: "fraicheur-espaces-fill", type: "fill", source: "fraicheur-espaces",
        paint: {
            "fill-color": [
                "interpolate", ["linear"], ["coalesce", ["get", "_fresh"], fMin],
                fMin, "#c8e6c9",   // peu de canopée → vert clair
                fMax, "#1b5e20",   // forte canopée  → vert foncé
            ],
            "fill-opacity": 0.6,
        },
    });

    etat.map.addLayer({
        id: "fraicheur-espaces-line", type: "line", source: "fraicheur-espaces",
        paint: {
            "line-color": "#2e7d32",
            "line-width": 1.5,
        },
    });

    etat.map.on("click", "fraicheur-espaces-fill", (ev) => {
        if (!ev.features.length) return;
        const props = ev.features[0].properties;
        const nom = props.nom || props.name || props.libelle || "Espace vert frais";
        const pct = props._fresh != null
            ? `<div class="fpopup-adr">${Math.round(props._fresh)} % de végétation haute</div>`
            : "";
        creerPopupPoint(
            [ev.lngLat.lng, ev.lngLat.lat],
            `<div class="fpopup">
                <div class="fpopup-cat" style="color:#2e7d32">🌿 ${nom}</div>
                ${pct}
            </div>`
        );
    });

    ajouterCurseur("fraicheur-espaces-fill");
    etat.fraicheurPrete = true;
    LAYERS_FRAICHEUR.forEach((id) => etat.map.setLayoutProperty(id, "visibility", "visible"));
}
