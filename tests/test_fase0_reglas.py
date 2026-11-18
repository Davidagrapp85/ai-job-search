"""Fase 0 (SPEC V2 §10): regresión de reglas en los datos de búsqueda de empleo.

Lee `05_Busqueda_Empleo/` (ignorado por git). Si la carpeta no existe, se omite.
Cubre T-DD-01 (regla de `declarado` solo en el banco), T-DD-02 (sin descarte por
puntaje) y T-DD-03 (sin clave `descartar:` en los ejes).
"""
import pathlib
import unittest

DATA = pathlib.Path(__file__).resolve().parent.parent / "05_Busqueda_Empleo"


def _texts(*globs):
    for g in globs:
        for p in DATA.glob(g):
            yield p, p.read_text(encoding="utf-8")


@unittest.skipUnless(DATA.is_dir(), "05_Busqueda_Empleo no está presente")
class Fase0Reglas(unittest.TestCase):
    def test_dd03_ejes_sin_descartar(self):
        for p, t in _texts("02_Configuracion/ejes/*.md"):
            self.assertNotIn("**descartar:**", t, p.name)

    def test_dd02_sin_descarte_por_puntaje(self):
        for p, t in _texts("07_Skills/*/SKILL.md"):
            for frase in ("menor de 50", "< 50 → descartada", "<50 → descartada"):
                self.assertNotIn(frase, t, f"{p.parent.name}: {frase}")

    def test_dd01_declarado_sin_aprobacion_contradictoria(self):
        for p, t in _texts("07_Skills/*/SKILL.md", "01_Perfil/cv_base.md",
                           "02_Configuracion/ejes/*.md"):
            for frase in ("aprobación de David", "que David apruebe",
                          "que David haya aprobado", "con aprobación)"):
                self.assertNotIn(frase, t, f"{p}: {frase}")

    def test_sin_discrecion_caducada(self):
        for p, t in _texts("07_Skills/*/SKILL.md"):
            self.assertNotIn("por discreción", t, p.parent.name)
            self.assertNotIn("empleo anterior actual", t, p.parent.name)

    def test_p01_empleo_anterior_no_es_actual(self):
        for p, t in _texts("01_Perfil/banco_evidencias.md", "01_Perfil/cv_base.md",
                           "01_Perfil/narrativa.md"):
            for linea in t.splitlines():
                if "ACME Fintech" in linea:
                    for frase in ("– hoy", "empleo actual", "título actual"):
                        self.assertNotIn(frase, linea, f"{p.name}: {linea[:60]}")



if __name__ == "__main__":
    unittest.main()


STATS = DATA / "07_Skills" / "empleo-tracker" / "stats.py"


@unittest.skipUnless(STATS.is_file(), "stats.py no está presente")
class Fase1Stats(unittest.TestCase):
    """M-02: stats.py da los mismos totales con las 4 columnas nuevas y acepta `aprobada`."""

    def _calcular(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("stats_tracker", STATS)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.calcular

    def test_m02_stats_acepta_columnas_nuevas(self):
        calcular = self._calcular()
        base = [
            {"numero": "001", "eje": "banca", "fecha": "2026-11-01", "estado": "enviada", "notas": ""},
            {"numero": "002", "eje": "banca", "fecha": "2026-11-01", "estado": "entrevista",
             "notas": "respuesta=2026-11-11"},
            {"numero": "003", "eje": "revenue", "fecha": "", "estado": "aprobada", "notas": ""},
        ]
        nuevas = [dict(f, application_id=f"APP-{i:04d}", decision="user_selected", canal="Lever",
                       fecha_envio=f["fecha"]) for i, f in enumerate(base, 1)]
        self.assertEqual(calcular(base), calcular(nuevas))
        self.assertEqual(calcular(nuevas)["enviadas"], 2)
