/* Vue comparaison : tableau indicateurs + graphiques Chart.js. */

import { etat } from "./config.js";
import { premier, ligneAnnee, anneeMax, nomArr, fmt, fmt1 } from "./utils.js";

export function majComparaison() {
    const codeA = Number(document.getElementById("select-a").value);
    const codeB = Number(document.getElementById("select-b").value);

    const indicateurs = [
        ["Prix médian €/m²",        (c) => ligneAnnee(etat.DATA.prix_m2[c], anneeMax(c))?.prix_m2_median],
        ["Évolution %",             (c) => ligneAnnee(etat.DATA.prix_m2[c], anneeMax(c))?.evolution_pct],
        ["Part logements sociaux %",(c) => ligneAnnee(etat.DATA.logements_sociaux_part[c], anneeMax(c))?.part_logements_sociaux_pct],
        ["Accessibilité m²/an",     (c) => premier(etat.DATA.accessibilite[c], "m2_par_revenu_annuel")],
        ["Fraîcheur (total)",       (c) => premier(etat.DATA.fraicheur[c], "nb_total_fraicheur")],
        ["Couverture transport <300 m %", (c) => premier(etat.DATA.transport[c], "couverture_300m_pct")],
        ["Marchés",                 (c) => premier(etat.DATA.marches[c], "nb_marches")],
        ["Tension (rendement %)",   (c) => premier(etat.DATA.tension[c], "rendement_locatif_pct")],
    ];

    // Tableau comparatif
    const lignesTableau = indicateurs
        .map(([label, fn]) => `
            <tr>
                <td>${label}</td>
                <td>${fmt1(fn(codeA))}</td>
                <td>${fmt1(fn(codeB))}</td>
            </tr>`)
        .join("");

    document.getElementById("tableau-comparaison").innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Indicateur</th>
                    <th class="col-a">${nomArr(codeA)}</th>
                    <th class="col-b">${nomArr(codeB)}</th>
                </tr>
            </thead>
            <tbody>${lignesTableau}</tbody>
        </table>`;

    // Graphique évolution des prix
    const annees = [...new Set(
        (etat.DATA.prix_m2[codeA] || [])
            .concat(etat.DATA.prix_m2[codeB] || [])
            .map((ligne) => ligne.annee)
    )].sort();

    const seriePrix = (code) => annees.map(
        (an) => ligneAnnee(etat.DATA.prix_m2[code], an)?.prix_m2_median ?? null
    );

    if (etat.chartPrix) etat.chartPrix.destroy();
    etat.chartPrix = new Chart(document.getElementById("chart-prix"), {
        type: "line",
        data: {
            labels: annees,
            datasets: [
                {
                    label: nomArr(codeA),
                    data: seriePrix(codeA),
                    borderColor: "#0aa1a8",
                    backgroundColor: "#0aa1a8",
                    tension: 0.25,
                },
                {
                    label: nomArr(codeB),
                    data: seriePrix(codeB),
                    borderColor: "#e3611a",
                    backgroundColor: "#e3611a",
                    tension: 0.25,
                },
            ],
        },
        options: { responsive: true },
    });

    // Graphique indicateurs composites
    const labelsComposites = ["Fraîcheur", "Transport <300 m %", "Marchés", "Part log. soc. %"];
    const valeursComposites = (code) => [
        premier(etat.DATA.fraicheur[code], "nb_total_fraicheur") || 0,
        premier(etat.DATA.transport[code], "couverture_300m_pct") || 0,
        premier(etat.DATA.marches[code], "nb_marches") || 0,
        ligneAnnee(etat.DATA.logements_sociaux_part[code], anneeMax(code))?.part_logements_sociaux_pct || 0,
    ];

    if (etat.chartComposites) etat.chartComposites.destroy();
    etat.chartComposites = new Chart(document.getElementById("chart-composites"), {
        type: "bar",
        data: {
            labels: labelsComposites,
            datasets: [
                { label: nomArr(codeA), data: valeursComposites(codeA), backgroundColor: "#0aa1a8" },
                { label: nomArr(codeB), data: valeursComposites(codeB), backgroundColor: "#e3611a" },
            ],
        },
        options: { responsive: true },
    });
}
