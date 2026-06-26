/* Panneau de détail droit : setArrActif, tooltipHTML, majDetail, sparkline. */

import { etat, COULEURS_PIECES } from "./config.js";
import {
    INDICATEURS_CARTE,
    premier, ligneAnnee, nomArr, fmt, fmt1, ordinal,
    toutesValeurs, mediane, rang,
} from "./utils.js";

// ---------- Bbox d'une feature Polygon/MultiPolygon ----------

export function bboxFeature(feature) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

    function parcourir(coords) {
        if (typeof coords[0] === "number") {
            const [lng, lat] = coords;
            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
        } else {
            coords.forEach(parcourir);
        }
    }

    parcourir(feature.geometry.coordinates);
    return [[minLng, minLat], [maxLng, maxLat]];
}

// ---------- Sélection d'un arrondissement actif ----------

export function setArrActif(code, centrer) {
    etat.arrActif = code;
    document.getElementById("select-arr").value = code;

    if (etat.carteReady && etat.map.getSource("arr")) {
        etat.GEO.features.forEach((feature) => {
            feature.properties._actif =
                feature.properties.code_arrondissement === code ? 1 : 0;
        });
        etat.map.getSource("arr").setData(etat.GEO);
        etat.map.setFilter("arr-line-active", ["==", ["get", "_actif"], 1]);

        if (centrer) {
            const feature = etat.GEO.features.find(
                (f) => f.properties.code_arrondissement === code
            );
            if (feature) {
                etat.map.fitBounds(bboxFeature(feature), {
                    padding: 40, maxZoom: 13, duration: 600,
                });
            }
        }
    }

    majDetail();
}

// ---------- Contenu du popup épinglé sur la carte ----------

export function tooltipHTML(code) {
    const ligneP   = ligneAnnee(etat.DATA.prix_m2[code], etat.anneeActive);
    const evolution = ligneP?.evolution_pct;
    const tendance  = evolution == null ? "" : `
        <span class="tt-trend ${evolution > 0 ? "up" : "down"}">
            ${evolution > 0 ? "▲" : "▼"} ${Math.abs(evolution)}%
        </span>`;
    const part     = ligneAnnee(etat.DATA.logements_sociaux_part[code], etat.anneeActive)?.part_logements_sociaux_pct;
    const fraicheur = premier(etat.DATA.fraicheur[code], "nb_total_fraicheur");
    const couverture = etat.couvertureMode?.[code] ?? premier(etat.DATA.transport[code], "couverture_300m_pct");
    const marches   = premier(etat.DATA.marches[code], "nb_marches");

    return `
        <div class="tt-head">
            <div class="tt-nom">${nomArr(code)}</div>
            <div class="tt-prix"><b>${fmt(ligneP?.prix_m2_median)} €/m²</b>${tendance}</div>
        </div>
        <div class="tt-grid">
            <div class="tt-cell"><div class="l">🏢 Logts sociaux</div><div class="v">${fmt1(part, "%")}</div></div>
            <div class="tt-cell"><div class="l">🌳 Fraîcheur</div><div class="v">${fmt(fraicheur)}</div></div>
            <div class="tt-cell"><div class="l">🚇 Transport &lt;300 m</div><div class="v">${fmt1(couverture, "%")}</div></div>
            <div class="tt-cell"><div class="l">🥕 Marchés</div><div class="v">${fmt(marches)}</div></div>
        </div>
        <div class="tt-foot">Détail complet dans le panneau de droite →</div>`;
}

// ---------- Sparkline SVG ----------

function sparkline(valeurs) {
    const vals = valeurs.filter((v) => v != null);
    if (vals.length < 2) return "";

    const w = 300, h = 34;
    const min   = Math.min(...vals);
    const max   = Math.max(...vals);
    const ecart = max - min || 1;

    const points = valeurs.map((v, i) => {
        const x = (i / (valeurs.length - 1)) * w;
        const y = h - 4 - ((v - min) / ecart) * (h - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    const couleurTrait = valeurs[valeurs.length - 1] >= valeurs[0] ? "#d64545" : "#1e8e54";

    return `
        <svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
            <polyline points="${points}" fill="none"
                stroke="${couleurTrait}" stroke-width="2.5" stroke-linejoin="round"/>
        </svg>`;
}

// ---------- Bloc KPI ----------

function carteKPI(icone, label, valeurHTML, piedHTML, spark) {
    return `
        <div class="kpi">
            <div class="kpi-top">
                <span class="kpi-ic">${icone}</span>
                <span class="kpi-label">${label}</span>
            </div>
            <div class="kpi-main">${valeurHTML}</div>
            ${piedHTML ? `<div class="kpi-foot">${piedHTML}</div>` : ""}
            ${spark || ""}
        </div>`;
}

// ---------- Mise à jour du panneau détail ----------

export function majDetail() {
    const code = etat.arrActif;

    const ligneP     = ligneAnnee(etat.DATA.prix_m2[code], etat.anneeActive);
    const evolution  = ligneP?.evolution_pct;
    const valPrix    = (c) => ligneAnnee(etat.DATA.prix_m2[c], etat.anneeActive)?.prix_m2_median;
    const rangPrix   = rang(code, valPrix);
    const medParis   = mediane(toutesValeurs(valPrix));
    const partAnnee  = (c) => ligneAnnee(etat.DATA.logements_sociaux_part[c], etat.anneeActive)?.part_logements_sociaux_pct;
    const part       = partAnnee(code);
    const acc        = premier(etat.DATA.accessibilite[code], "m2_par_revenu_annuel");
    const tension    = premier(etat.DATA.tension[code], "rendement_locatif_pct");
    const fraicheur  = premier(etat.DATA.fraicheur[code], "nb_total_fraicheur");
    const arrets     = premier(etat.DATA.transport[code], "nb_total_arrets");
    // Couverture mode-aware : suit le filtre de mode de la carte (etat.couvertureMode), sinon Gold tous modes
    const couvertureFn = (c) => etat.couvertureMode?.[c] ?? premier(etat.DATA.transport[c], "couverture_300m_pct");
    const couverture = couvertureFn(code);
    const ligneLog   = ligneAnnee(etat.DATA.logements_sociaux[code], etat.anneeActive);
    const logFinances = ligneLog?.nb_logements_sociaux ?? null;
    const logCumul    = ligneLog?.cumul_logements ?? null;
    const rangLog     = logFinances == null ? null
        : rang(code, (c) => ligneAnnee(etat.DATA.logements_sociaux[c], etat.anneeActive)?.nb_logements_sociaux ?? null);

    const entete = `
        <div class="detail-head">
            <div class="dh-arr">${nomArr(code)}</div>
            <div class="dh-sub">Paris · données ${etat.anneeActive}</div>
            <div class="dh-tags">
                <span class="dh-tag">🏠 ${ordinal(rangPrix)}/20 le plus cher</span>
                <span class="dh-tag">🌳 ${fmt(fraicheur)} pts fraîcheur</span>
                <span class="dh-tag">🚇 ${fmt1(couverture, "%")} desservi</span>
            </div>
        </div>`;

    const badge = evolution == null
        ? `<span class="badge flat">n/a</span>`
        : `<span class="badge ${evolution > 0 ? "up" : "down"}">
               ${evolution > 0 ? "▲" : "▼"} ${Math.abs(evolution)} % vs ${etat.anneeActive - 1}
           </span>`;

    const seriePrix = etat.annees.map(
        (an) => ligneAnnee(etat.DATA.prix_m2[code], an)?.prix_m2_median ?? null
    );

    const kpiPrix = carteKPI(
        "🏠",
        `Prix médian au m² (${etat.anneeActive})`,
        `<span class="kpi-value">${fmt(ligneP?.prix_m2_median)}</span><span class="kpi-unit">€/m²</span>`,
        `${badge}<span class="kpi-ctx">${ordinal(rangPrix)}/20 · médiane Paris ${fmt(medParis)} €</span>`,
        sparkline(seriePrix)
    );

    const kpiSocial = carteKPI(
        "🏢",
        "Part de logements sociaux",
        `<span class="kpi-value">${fmt1(part)}</span><span class="kpi-unit">%</span>`,
        `<span class="kpi-ctx">
            ${ordinal(rang(code, partAnnee))}/20 · ${etat.anneeActive}
        </span>`
    );

    const kpiLogFinances = carteKPI(
        "🏗️",
        `Logements sociaux financés (${etat.anneeActive})`,
        `<span class="kpi-value">${fmt(logFinances)}</span><span class="kpi-unit">logements</span>`,
        `<span class="kpi-ctx">
            ${rangLog ? ordinal(rangLog) + "/20 · " : ""}cumul ${fmt(logCumul)} logements
        </span>`
    );

    const kpiAcc = carteKPI(
        "💶",
        "Accessibilité",
        `<span class="kpi-value">${fmt1(acc)}</span><span class="kpi-unit">m²/an de revenu</span>`,
        `<span class="kpi-ctx">surface achetable avec 1 an de revenu médian</span>`
    );

    const kpiTens = carteKPI(
        "📈",
        "Tension immobilière",
        `<span class="kpi-value">${fmt1(tension)}</span><span class="kpi-unit">% rendement locatif</span>`,
        `<span class="kpi-ctx">plus c'est bas, plus la tension est forte</span>`
    );

    const kpiTransport = carteKPI(
        "🚇",
        "Couverture transport",
        `<span class="kpi-value">${fmt1(couverture)}</span><span class="kpi-unit">% à moins de 300 m</span>`,
        `<span class="kpi-ctx">
            ${ordinal(rang(code, couvertureFn))}/20 ·
            ${fmt(arrets)} arrêts
        </span>`
    );

    // Distribution par nombre de pièces
    const ordrePieces = ["Studio/T1", "T2", "T3", "T4+"];
    const pieces = (etat.DATA.pieces[code] || [])
        .slice()
        .sort((a, b) => ordrePieces.indexOf(a.categorie) - ordrePieces.indexOf(b.categorie));

    const segments = pieces.map((piece) => {
        const coul  = COULEURS_PIECES[piece.categorie] || "#999";
        const label = piece.part_pct >= 9 ? `${piece.part_pct}%` : "";
        return `<div class="distrib-seg"
                     style="flex:${piece.part_pct};background:${coul}"
                     title="${piece.categorie} ${piece.part_pct}%">${label}</div>`;
    }).join("");

    const legendePieces = pieces.map((piece) => `
        <div class="row">
            <span class="swatch" style="background:${COULEURS_PIECES[piece.categorie] || "#999"}"></span>
            ${piece.categorie} ${piece.part_pct}%
        </div>`).join("");

    const maison = (etat.DATA.types_logements[code] || []).find((t) => t.type_local === "Maison");
    const infoMaison = maison
        ? `🏡 Maisons : ${maison.part_pct}% des biens`
        : "🏡 Maisons : &lt;1% (Paris intra-muros)";

    const distribPieces = `
        <div class="distrib-card">
            <h4>Répartition par nombre de pièces</h4>
            <div class="distrib-bar">${segments}</div>
            <div class="distrib-legend">${legendePieces}</div>
            <div class="distrib-extra">${infoMaison}</div>
        </div>`;

    document.getElementById("detail").innerHTML =
        entete + kpiPrix + kpiSocial + kpiLogFinances + kpiAcc + kpiTens + kpiTransport + distribPieces;
}
