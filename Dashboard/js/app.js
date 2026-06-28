/* Point d'entrée — chargement des données, interface et navigation entre vues. */

import { etat, API } from "./config.js";
import { INDICATEURS_CARTE, nomArr, codes, setStatus } from "./utils.js";
import { initCarte, rafraichirCarte, calculerPaliers } from "./carte.js";
import { toggleFontaines, toggleMarches, toggleTransport } from "./couches.js";
import { setArrActif, majDetail } from "./detail.js";
import { majComparaison } from "./comparaison.js";

// ---------- Chargement des données ----------

async function chargerDonnees() {
    try {
        const [geo, data] = await Promise.all([
            fetch(`${API}/arrondissements`).then((r) => r.json()),
            fetch(`${API}/dashboard`).then((r) => r.json()),
        ]);

        etat.GEO = geo;
        Object.assign(etat.DATA, data);

        etat.annees = [...new Set(
            Object.values(etat.DATA.prix_m2).flat().map((ligne) => ligne.annee)
        )].sort();
        etat.anneeActive = etat.annees[etat.annees.length - 1];

        setStatus(null);
        initInterface();
    } catch (erreur) {
        setStatus(
            "Impossible de joindre l'API (http://localhost:8000). Vérifiez le service 'api' et l'exécution des pipelines.",
            true
        );
        console.error(erreur);
    }
}

// ---------- Timeline ----------

function majAnnee(index) {
    etat.anneeActive = etat.annees[index];
    document.getElementById("annee-label").textContent = etat.anneeActive;
    document.getElementById("annee-slider").value = index;
    if (INDICATEURS_CARTE[etat.indicateurCourant]?.parAnnee) {
        rafraichirCarte();
    }
    majDetail();
}

// ---------- Navigation entre vues ----------

function switchVue(vue) {
    const estCarte = vue === "carte";
    document.getElementById("vue-carte").classList.toggle("hidden", !estCarte);
    document.getElementById("vue-comparaison").classList.toggle("hidden", estCarte);
    document.getElementById("tab-carte").classList.toggle("active", estCarte);
    document.getElementById("tab-comparaison").classList.toggle("active", !estCarte);

    if (estCarte && etat.map) {
        setTimeout(() => etat.map.resize(), 60);
    } else {
        majComparaison();
    }
}

// ---------- Initialisation de l'interface ----------

function initInterface() {
    const tousLesCodes = codes().sort((a, b) => a - b);

    // Sélecteur d'indicateur
    const selIndicateur = document.getElementById("select-indicateur");
    for (const [cle, cfg] of Object.entries(INDICATEURS_CARTE)) {
        selIndicateur.add(new Option(`${cfg.icon}  ${cfg.label}`, cle));
    }
    selIndicateur.value = etat.indicateurCourant;
    selIndicateur.addEventListener("change", () => {
        etat.indicateurCourant = selIndicateur.value;
        rafraichirCarte();
    });

    // Sélecteur d'arrondissement
    const selArr = document.getElementById("select-arr");
    for (const code of tousLesCodes) {
        selArr.add(new Option(`${code} — ${nomArr(code)}`, code));
    }
    selArr.addEventListener("change", () => setArrActif(Number(selArr.value), true));

    // Timeline (slider + boutons)
    const slider = document.getElementById("annee-slider");
    slider.min   = 0;
    slider.max   = etat.annees.length - 1;
    slider.value = etat.annees.length - 1;
    slider.addEventListener("input", () => majAnnee(Number(slider.value)));

    document.getElementById("annee-prev").addEventListener("click", () => {
        if (slider.value > 0) majAnnee(Number(slider.value) - 1);
    });
    document.getElementById("annee-next").addEventListener("click", () => {
        if (slider.value < etat.annees.length - 1) majAnnee(Number(slider.value) + 1);
    });
    document.getElementById("annee-label").textContent = etat.anneeActive;

    // Toggles couches de points
    document.getElementById("toggle-fontaines").addEventListener("change", (e) => {
        toggleFontaines(e.target.checked);
    });
    document.getElementById("toggle-marches").addEventListener("change", (e) => {
        toggleMarches(e.target.checked);
    });
    document.getElementById("toggle-transport").addEventListener("change", (e) => {
        toggleTransport(e.target.checked);
    });

    // Sélecteurs comparaison
    const selA = document.getElementById("select-a");
    const selB = document.getElementById("select-b");
    for (const code of tousLesCodes) {
        selA.add(new Option(`${code} — ${nomArr(code)}`, code));
        selB.add(new Option(`${code} — ${nomArr(code)}`, code));
    }
    selA.value = 1;
    selB.value = 16;
    selA.addEventListener("change", majComparaison);
    selB.addEventListener("change", majComparaison);

    // Sélecteur d'année de la comparaison (indépendant du curseur de la carte)
    const selAnneeCmp = document.getElementById("select-annee-cmp");
    for (const an of etat.annees) selAnneeCmp.add(new Option(an, an));
    etat.anneeComparaison = etat.annees[etat.annees.length - 1];
    selAnneeCmp.value = etat.anneeComparaison;
    selAnneeCmp.addEventListener("change", () => {
        etat.anneeComparaison = Number(selAnneeCmp.value);
        majComparaison();
    });

    // Onglets
    document.getElementById("tab-carte").addEventListener("click", () => switchVue("carte"));
    document.getElementById("tab-comparaison").addEventListener("click", () => switchVue("comparaison"));

    // Lancement de la carte
    initCarte();
    etat.paliers = calculerPaliers();
    rafraichirCarte();
    setArrActif(1, false);
}

// ---------- Démarrage ----------
chargerDonnees();
