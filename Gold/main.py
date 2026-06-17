import subprocess
import os

project_root = os.path.dirname(__file__)

scripts = [
    "Gold_prix_m2.py",
    "Gold_types_logements.py",
    "Gold_accessibilite.py",
    "Gold_logements_sociaux.py",
    "Gold_logements_sociaux_part.py",
    "Gold_pieces.py",
    "Gold_fraicheur.py",
    "Gold_transport.py",
    "Gold_marches.py",
    "Gold_tension.py",
    "Gold_fontaines.py",
    "Gold_fraicheur_points.py",
    "Gold_marches_points.py",
    "Gold_transport_points.py",
]

failed = []

for script in scripts:

    script_path = os.path.join(project_root, "traitement", script)

    print("\n" + "=" * 50)
    print(f"Lancement de : {script}")
    print("=" * 50)

    try:
        subprocess.run(
            ["python", script_path],
            check=True,
            cwd=os.path.join(project_root, "traitement"),
        )
        print(f"{script} terminé avec succès.")

    except subprocess.CalledProcessError as e:
        print(f"Erreur lors de l'exécution de {script}")
        print(e)
        failed.append(script)

print("\n" + "=" * 50)
if not failed:
    print("Tous les scripts Gold ont été exécutés.")
else:
    print(f"{len(failed)} script(s) en échec :")
    for s in failed:
        print(f"  - {s}")
print("=" * 50)
