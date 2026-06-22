/* Fonctions utilitaires pures, helpers carte et définition des indicateurs. */

import { etat, COULEURS_SOURCE, CAT_HORS, CAT_COMMERCE, CATEGORIES, TYPES_FONTAINE } from "./config.js";

// ---------- Accès aux données ----------

export function premier(liste, colonne) {
    return liste && liste.length ? liste[0][colonne] : null;
}

export function ligneAnnee(liste, annee) {
    return (liste || []).find((ligne) => ligne.annee === annee) || null;
}

export function anneeMax(code) {
    const lignes = etat.DATA.prix_m2[code] || [];
    return lignes.length ? Math.max(...lignes.map((l) => l.annee)) : null;
}

export function nomArr(code) {
    const feature = etat.GEO.features.find(
        (f) => f.properties.code_arrondissement === code
    );
    return feature?.properties.nom || `Arrondissement ${code}`;
}

export function codes() {
    return etat.GEO.features.map((f) => f.properties.code_arrondissement);
}

// ---------- Formatage ----------

export function fmt(valeur, unite) {
    if (valeur === null || valeur === undefined) return "—";
    const n = typeof valeur === "number"
        ? Math.round(valeur).toLocaleString("fr-FR")
        : valeur;
    return unite ? `${n} ${unite}` : `${n}`;
}

export function fmt1(valeur, unite) {
    if (valeur === null || valeur === undefined) return "—";
    const n = typeof valeur === "number"
        ? valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
        : valeur;
    return unite ? `${n} ${unite}` : `${n}`;
}

export function ordinal(n) {
    return n === 1 ? "1ᵉʳ" : `${n}ᵉ`;
}

export function setStatus(message, erreur) {
    const el = document.getElementById("status");
    if (!message) {
        el.classList.add("hidden");
        return;
    }
    el.textContent = message;
    el.classList.remove("hidden");
    el.classList.toggle("error", !!erreur);
}

// ---------- Statistiques ----------

export function toutesValeurs(fn) {
    return codes()
        .map((code) => fn(code))
        .filter((v) => v !== null && v !== undefined);
}

export function mediane(tableau) {
    if (!tableau.length) return null;
    const trie = [...tableau].sort((a, b) => a - b);
    const milieu = Math.floor(trie.length / 2);
    return trie.length % 2 ? trie[milieu] : (trie[milieu - 1] + trie[milieu]) / 2;
}

export function rang(code, fn) {
    const valeur = fn(code);
    if (valeur == null) return null;
    return toutesValeurs(fn).sort((a, b) => b - a).indexOf(valeur) + 1;
}

// ---------- Helpers carte MapLibre ----------

export function ajouterCurseur(...ids) {
    for (const id of ids) {
        etat.map.on("mouseenter", id, () => {
            etat.map.getCanvas().style.cursor = "pointer";
        });
        etat.map.on("mouseleave", id, () => {
            etat.map.getCanvas().style.cursor = "";
        });
    }
}

export function creerPopupPoint(coordonnees, html, offset = 12) {
    new maplibregl.Popup({ offset })
        .setLngLat(coordonnees)
        .setHTML(html)
        .addTo(etat.map);
}

export async function fetchCouche(url) {
    try {
        return await fetch(url).then((r) => r.json());
    } catch (erreur) {
        console.error("Erreur chargement couche :", erreur);
        return null;
    }
}

export function toGeoJSON(donnees, propsOf) {
    return {
        type: "FeatureCollection",
        features: donnees
            .filter((pt) => pt.lat != null && pt.lon != null)
            .map((pt) => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: [pt.lon, pt.lat] },
                properties: propsOf(pt),
            })),
    };
}

// ---------- Catégorie fontaine ----------

export function categorieFontaine(fontaine) {
    if (!fontaine.disponible) return CAT_HORS;
    if (fontaine.type === "FTNE_PETILLANTE") return { cle: "petillante", ...CATEGORIES.petillante };
    if (fontaine.type === "FONTAINE_2EN1")   return { cle: "brumisation", ...CATEGORIES.brumisation };
    return { cle: "plate", ...CATEGORIES.plate };
}

// ---------- Indicateurs cartographiables ----------
// Définis ici car les fonctions valeur() utilisent premier() et ligneAnnee() ci-dessus.

// `vertSiHaut` oriente la rampe vert→rouge : true = valeur haute en vert (bonne),
// false = valeur basse en vert. fraicheur a son propre dégradé (choroplèthe transparente).
export const INDICATEURS_CARTE = {
    prix_m2: {
        label: "Prix médian au m²", unite: "€/m²", icon: "🏠", vertSiHaut: false, parAnnee: true,
        valeur: (code) => {
            const ligne = ligneAnnee(etat.DATA.prix_m2?.[code], etat.anneeActive);
            return ligne ? ligne.prix_m2_median : null;
        },
    },
    logements_sociaux_part: {
        label: "Part de logements sociaux", unite: "%", icon: "🏢", vertSiHaut: true, parAnnee: true,
        valeur: (code) => ligneAnnee(etat.DATA.logements_sociaux_part?.[code], etat.anneeActive)
            ?.part_logements_sociaux_pct ?? null,
    },
    logements_sociaux: {
        label: "Logements sociaux financés", unite: "", icon: "🏗️", vertSiHaut: true, parAnnee: true,
        valeur: (code) => ligneAnnee(etat.DATA.logements_sociaux?.[code], etat.anneeActive)
            ?.nb_logements_sociaux ?? null,
    },
    accessibilite: {
        label: "Accessibilité (m²/an de revenu)", unite: "m²", icon: "💶", vertSiHaut: true,
        valeur: (code) => premier(etat.DATA.accessibilite?.[code], "m2_par_revenu_annuel"),
    },
    fraicheur: {
        label: "Fraîcheur urbaine", unite: "pts", icon: "🌳", vertSiHaut: true,
        valeur: (code) => premier(etat.DATA.fraicheur?.[code], "nb_total_fraicheur"),
    },
    transport: {
        label: "Couverture transport (<300 m)", unite: "%", icon: "🚇", vertSiHaut: true,
        // Couverture par modes cochés si les arrêts sont chargés, sinon valeur Gold (tous modes)
        valeur: (code) => etat.couvertureMode?.[code]
            ?? premier(etat.DATA.transport?.[code], "couverture_300m_pct"),
    },
    marches: {
        label: "Marchés alimentaires", unite: "", icon: "🥕", vertSiHaut: true,
        valeur: (code) => premier(etat.DATA.marches?.[code], "nb_marches"),
    },
    tension: {
        label: "Tension (rendement locatif)", unite: "%", icon: "📈", vertSiHaut: true,
        valeur: (code) => premier(etat.DATA.tension?.[code], "rendement_locatif_pct"),
    },
};
