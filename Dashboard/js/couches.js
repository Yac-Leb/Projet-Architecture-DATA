/* Couches de points toggleables : fontaines & commerces eau, marchés, transport. */

import { etat, API, CAT_COMMERCE, TYPES_FONTAINE, COULEURS_MODE, MODES_LABEL } from "./config.js";
import { ajouterCurseur, creerPopupPoint, fetchCouche, toGeoJSON, categorieFontaine } from "./utils.js";
import { rafraichirCarte } from "./carte.js";
import { recalculerCouvertureTransport } from "./couverture.js";
import { majDetail } from "./detail.js";

// Recalcule la couverture selon les modes cochés, recolore la carte (si l'indicateur
// transport est affiché) et met à jour le panneau détail (qui suit le filtre de mode).
function rafraichirCouvertureMode() {
    recalculerCouvertureTransport();
    if (etat.indicateurCourant === "transport") rafraichirCarte();
    majDetail();
}

// =====================================================================
// Fontaines & commerces eau de Paris
// =====================================================================

export async function toggleFontaines(actif) {
    const legende = document.getElementById("fontaines-legende");

    if (!actif) {
        if (etat.fontainesPretes) {
            etat.map.setLayoutProperty("fontaines-pt", "visibility", "none");
        }
        legende.classList.add("hidden");
        return;
    }

    if (!etat.fontainesData) {
        etat.fontainesData = await fetchCouche(`${API}/fontaines`);
        if (!etat.fontainesData) return;
    }

    if (!etat.commerceData) {
        const pts = etat.fraicheurData || await fetchCouche(`${API}/fraicheur_points`);
        if (!etat.fraicheurData) etat.fraicheurData = pts;
        etat.commerceData = (pts || []).filter((p) => p.source === "Commerce eau de Paris");
    }

    if (!etat.fontainesPretes) construireFontaines();

    etat.map.setLayoutProperty("fontaines-pt", "visibility", "visible");
    appliquerFiltreFontaines();
    majLegendeFontaines();
    legende.classList.remove("hidden");
}

function construireFontaines() {
    etat.fontainesLegende = {};

    function compterCategorie(cat) {
        if (!etat.fontainesLegende[cat.cle]) {
            etat.fontainesLegende[cat.cle] = {
                label: cat.label, color: cat.color, icon: cat.icon, n: 0,
            };
        }
        etat.fontainesLegende[cat.cle].n++;
    }

    const propsFontaine = (fontaine) => {
        const cat = categorieFontaine(fontaine);
        compterCategorie(cat);
        return {
            cat:      cat.cle,
            color:    cat.color,
            catLabel: cat.label,
            catIcon:  cat.icon,
            typeLabel: TYPES_FONTAINE[fontaine.type] || fontaine.type || "Fontaine",
            adresse:  fontaine.adresse || "",
            arr:      fontaine.code_arrondissement ?? "—",
            modele:   fontaine.modele || "—",
            statut:   fontaine.disponible
                ? "<b style='color:#1e8e54'>● En service</b>"
                : "<b style='color:#d64545'>● Hors service</b>",
        };
    };

    const propsCommerce = (point) => {
        compterCategorie(CAT_COMMERCE);
        return {
            cat:      CAT_COMMERCE.cle,
            color:    CAT_COMMERCE.color,
            catLabel: CAT_COMMERCE.label,
            catIcon:  CAT_COMMERCE.icon,
            typeLabel: "Point d'eau partenaire Eau de Paris",
            adresse:  point.nom || "",
            arr:      point.code_arrondissement ?? "—",
            modele:   "",
            statut:   "",
        };
    };

    const geoJSON = {
        type: "FeatureCollection",
        features: [
            ...toGeoJSON(etat.fontainesData, propsFontaine).features,
            ...toGeoJSON(etat.commerceData || [], propsCommerce).features,
        ],
    };

    etat.map.addSource("fontaines", { type: "geojson", data: geoJSON });

    etat.map.addLayer({
        id: "fontaines-pt", type: "circle", source: "fontaines",
        layout: { visibility: "none" },
        paint: {
            "circle-color":        ["get", "color"],
            "circle-radius":       5,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
        },
    });

    etat.map.on("click", "fontaines-pt", (ev) => {
        const p = ev.features[0].properties;
        const meta = `Arr. ${p.arr}${p.modele ? " · " + p.modele : ""}`;
        creerPopupPoint(
            ev.features[0].geometry.coordinates,
            `<div class="fpopup">
                <div class="fpopup-cat" style="color:${p.color}">${p.catIcon} ${p.catLabel}</div>
                <div class="fpopup-type">${p.typeLabel}</div>
                <div class="fpopup-adr">${p.adresse}</div>
                <div class="fpopup-meta">${meta}</div>
                ${p.statut ? `<div class="fpopup-statut">${p.statut}</div>` : ""}
            </div>`
        );
    });

    ajouterCurseur("fontaines-pt");
    etat.fontainesPretes = true;
}

function appliquerFiltreFontaines() {
    if (!etat.fontainesPretes) return;
    const visibles = Object.keys(etat.catVisible).filter((cle) => etat.catVisible[cle]);
    etat.map.setFilter("fontaines-pt", ["in", ["get", "cat"], ["literal", visibles]]);
}

function toggleCategorieFontaine(cle) {
    if (!etat.fontainesPretes) return;
    etat.catVisible[cle] = !etat.catVisible[cle];
    appliquerFiltreFontaines();
    majLegendeFontaines();
}

function majLegendeFontaines() {
    if (!etat.fontainesLegende) return;

    const ordre = ["plate", "brumisation", "petillante", "hors", "commerce"];
    const lignes = ordre
        .filter((cle) => etat.fontainesLegende[cle])
        .map((cle) => {
            const cat = etat.fontainesLegende[cle];
            const actif = etat.catVisible[cle] ? "" : "off";
            return `
                <div class="frow ${actif}" data-cle="${cle}" title="Afficher / masquer">
                    <span class="fdot" style="background:${cat.color}"></span>
                    <span class="flabel">${cat.icon} ${cat.label}</span>
                    <span class="fn">${cat.n}</span>
                </div>`;
        })
        .join("");

    const boite = document.getElementById("fontaines-legende");
    boite.innerHTML = `
        <div class="fleg-titre">Points d'eau</div>
        ${lignes}
        <div class="fleg-note">Cliquez une catégorie pour l'afficher/masquer · cliquez un point pour ses détails</div>`;

    boite.querySelectorAll(".frow[data-cle]").forEach((el) => {
        el.addEventListener("click", () => toggleCategorieFontaine(el.dataset.cle));
    });
}

// =====================================================================
// Marchés alimentaires
// =====================================================================

export async function toggleMarches(actif) {
    if (!actif) {
        if (etat.marchesPrets) {
            etat.map.setLayoutProperty("marches-pt", "visibility", "none");
        }
        return;
    }

    if (!etat.marchesData) {
        etat.marchesData = await fetchCouche(`${API}/marches_points`);
        if (!etat.marchesData) return;
    }

    if (!etat.marchesPrets) construireMarches();

    etat.map.setLayoutProperty("marches-pt", "visibility", "visible");
}

function construireMarches() {
    etat.map.addSource("marches-src", {
        type: "geojson",
        data: toGeoJSON(etat.marchesData, (marche) => ({
            nom:  marche.nom || "Marché",
            jours: marche.jours || "",
            arr:  marche.code_arrondissement ?? "—",
        })),
    });

    etat.map.addLayer({
        id: "marches-pt", type: "circle", source: "marches-src",
        layout: { visibility: "none" },
        paint: {
            "circle-color":        "#e3611a",
            "circle-radius":       7,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
        },
    });

    etat.map.on("click", "marches-pt", (ev) => {
        const p = ev.features[0].properties;
        creerPopupPoint(
            ev.features[0].geometry.coordinates,
            `<div class="fpopup">
                <div class="fpopup-cat" style="color:#e3611a">🥕 Marché alimentaire</div>
                <div class="fpopup-type">${p.nom}</div>
                ${p.jours ? `<div class="fpopup-adr">📅 ${p.jours}</div>` : ""}
                <div class="fpopup-meta">Arr. ${p.arr}</div>
            </div>`
        );
    });

    ajouterCurseur("marches-pt");
    etat.marchesPrets = true;
}

// =====================================================================
// Arrêts de transport
// =====================================================================

export async function toggleTransport(actif) {
    const legende = document.getElementById("transport-legende");

    if (!actif) {
        if (etat.transportPrets) {
            etat.map.setLayoutProperty("transport-pt", "visibility", "none");
        }
        legende.classList.add("hidden");
        return;
    }

    if (!etat.transportData) {
        etat.transportData = await fetchCouche(`${API}/transport_points`);
        if (!etat.transportData) return;
    }

    if (!etat.transportPrets) construireTransport();

    etat.map.setLayoutProperty("transport-pt", "visibility", "visible");
    appliquerFiltreTransport();
    majLegendeTransport();
    legende.classList.remove("hidden");
    rafraichirCouvertureMode();
}

function construireTransport() {
    etat.map.addSource("transport-src", {
        type: "geojson",
        data: toGeoJSON(etat.transportData, (arret) => {
            const mode = (arret.mode || "bus").toLowerCase();
            return {
                nom:   arret.nom || "",
                mode,
                arr:   arret.code_arrondissement ?? "—",
                color: COULEURS_MODE[mode] || "#888",
            };
        }),
    });

    etat.map.addLayer({
        id: "transport-pt", type: "circle", source: "transport-src",
        layout: { visibility: "none" },
        paint: {
            "circle-color":        ["get", "color"],
            "circle-radius":       4,
            "circle-stroke-width": 1.2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity":      0.85,
        },
    });

    etat.map.on("click", "transport-pt", (ev) => {
        const p     = ev.features[0].properties;
        const coul  = COULEURS_MODE[p.mode] || "#888";
        const label = MODES_LABEL[p.mode] || p.mode;
        creerPopupPoint(
            ev.features[0].geometry.coordinates,
            `<div class="fpopup">
                <div class="fpopup-cat" style="color:${coul}">${label}</div>
                <div class="fpopup-type">${p.nom}</div>
                <div class="fpopup-meta">Arr. ${p.arr}</div>
            </div>`,
            10
        );
    });

    ajouterCurseur("transport-pt");
    etat.transportPrets = true;
}

function appliquerFiltreTransport() {
    if (!etat.transportPrets) return;
    const visibles = Object.keys(etat.catVisibleTransport).filter((m) => etat.catVisibleTransport[m]);
    etat.map.setFilter("transport-pt", ["in", ["get", "mode"], ["literal", visibles]]);
}

function toggleModeTransport(mode) {
    etat.catVisibleTransport[mode] = !etat.catVisibleTransport[mode];
    appliquerFiltreTransport();
    majLegendeTransport();
    rafraichirCouvertureMode();
}

function majLegendeTransport() {
    if (!etat.transportPrets) return;

    const comptage = {};
    for (const arret of etat.transportData) {
        const mode = (arret.mode || "bus").toLowerCase();
        comptage[mode] = (comptage[mode] || 0) + 1;
    }

    const lignes = Object.keys(MODES_LABEL)
        .filter((mode) => comptage[mode])
        .map((mode) => {
            const actif = etat.catVisibleTransport[mode] ? "" : "off";
            return `
                <div class="frow ${actif}" data-mode="${mode}" title="Afficher / masquer">
                    <span class="fdot" style="background:${COULEURS_MODE[mode]}"></span>
                    <span class="flabel">${MODES_LABEL[mode]}</span>
                    <span class="fn">${comptage[mode]}</span>
                </div>`;
        })
        .join("");

    const boite = document.getElementById("transport-legende");
    boite.innerHTML = `
        <div class="fleg-titre">Modes de transport</div>
        ${lignes}
        <div class="fleg-note">Cliquez un mode pour l'afficher/masquer</div>`;

    boite.querySelectorAll(".frow[data-mode]").forEach((el) => {
        el.addEventListener("click", () => toggleModeTransport(el.dataset.mode));
    });
}
