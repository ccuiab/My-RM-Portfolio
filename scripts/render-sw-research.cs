// Native viewport capture only. No Save/Save3, rebuild, virtualisation or export
// of CAD documents. Loaded by render-sw-research.ps1 against SW typed interop.
using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using SolidWorks.Interop.sldworks;
using SolidWorks.Interop.swconst;

public static class ResearchSwCapture {
    static ISldWorks S(object app) { return (ISldWorks)app; }
    public static int ProcessId(object app) { return S(app).GetProcessID(); }
    public static Dictionary<string, bool> GlobalPreferences(object app) {
        return new Dictionary<string, bool> {
            { "autoSave", S(app).GetUserPreferenceToggle((int)swUserPreferenceToggle_e.swAutoSaveEnable) },
            { "backup", S(app).GetUserPreferenceToggle((int)swUserPreferenceToggle_e.swBackupEnable) },
            { "backgroundControl", S(app).UserControlBackground }
        };
    }
    public static void DisableAutomaticWrites(object app) {
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swAutoSaveEnable, false);
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swBackupEnable, false);
    }
    public static void RestoreGlobalPreferences(object app, Dictionary<string, bool> old) {
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swAutoSaveEnable, old["autoSave"]);
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swBackupEnable, old["backup"]);
        S(app).UserControlBackground = old["backgroundControl"];
    }
    static ModelDoc2 D(object app, string path) { return (ModelDoc2)S(app).GetOpenDocumentByName(path); }
    static string Json(object x) { var js = new JavaScriptSerializer(); js.MaxJsonLength = int.MaxValue; return js.Serialize(x); }
    static swUserPreferenceToggle_e[] toggles = {
        swUserPreferenceToggle_e.swViewDisplayHideAllTypes,
        swUserPreferenceToggle_e.swDisplayShadowsInShadedMode,
        swUserPreferenceToggle_e.swDisplayPlanes,
        swUserPreferenceToggle_e.swDisplaySketches,
        swUserPreferenceToggle_e.swDisplayTemporaryAxes,
        swUserPreferenceToggle_e.swDisplayAmbientOcclusionShadows,
        swUserPreferenceToggle_e.swDisplayRealViewGraphics
    };
    static Dictionary<int, bool> originalToggles;
    static double[] originalOrientation, originalTranslation;
    static double originalScale;
    static int originalMode;
    static bool originalFloorShadows, originalFloorReflections;
    public static void Prepare(object app, string path) {
        var doc = D(app, path);
        if (!doc.IsOpenedReadOnly()) throw new Exception("Document must be read-only");
        doc.Visible = true; int error = 0; S(app).ActivateDoc3(path, false, 1, ref error);
        if (error != 0) throw new Exception("Cannot activate source: " + error);
        doc.ClearSelection2(true);
        var view = (ModelView)doc.ActiveView;
        originalOrientation = (double[])view.Orientation3.ArrayData;
        originalTranslation = (double[])view.Translation3.ArrayData;
        originalScale = view.Scale2; originalMode = view.DisplayMode;
        originalToggles = new Dictionary<int, bool>();
        foreach (var toggle in toggles) {
            originalToggles[(int)toggle] = doc.GetUserPreferenceToggle((int)toggle);
            doc.SetUserPreferenceToggle((int)toggle, toggle == swUserPreferenceToggle_e.swViewDisplayHideAllTypes);
        }
        var scene = (SWScene)((Configuration)doc.GetActiveConfiguration()).GetScene();
        if (scene != null) {
            originalFloorShadows = scene.FloorShadows; originalFloorReflections = scene.FloorReflections;
            scene.FloorShadows = false; scene.FloorReflections = false;
        }
        doc.ViewDisplayShaded();
        view.DisplayMode = (int)swViewDisplayMode_e.swViewDisplayMode_ShadedWithEdges;
        doc.GraphicsRedraw2();
    }
    public static string LauncherComponents(object app, string path, string[] hidden, string[] translucent) {
        var doc = D(app, path); var rows = new List<object>();
        var hide = new HashSet<string>(hidden); var fade = new HashSet<string>(translucent);
        var matched = new HashSet<string>();
        foreach (object item in (object[])((AssemblyDoc)doc).GetComponents(false)) {
            var c = (Component2)item; string name = c.Name2;
            if (hide.Contains(name)) { c.Visible = 0; matched.Add(name); rows.Add(new { name, action = "hidden" }); }
            else if (fade.Contains(name)) {
                double[] values = c.GetMaterialPropertyValues2((int)swInConfigurationOpts_e.swThisConfiguration, null) as double[];
                if (values == null || values.Length < 9 || values[0] < 0)
                    values = c.GetModelMaterialPropertyValues(c.ReferencedConfiguration) as double[];
                if (values == null || values.Length < 9 || values[0] < 0)
                    throw new Exception("Cannot preserve native material while fading " + name);
                double[] old = (double[])values.Clone(); values[7] = .82;
                c.SetMaterialPropertyValues2(values, (int)swInConfigurationOpts_e.swThisConfiguration, null);
                c.Visible = 1; matched.Add(name); rows.Add(new { name, action = "opacity 0.18", originalMaterial = old, captureMaterial = values });
            } else rows.Add(new { name, action = c.IsHidden(false) ? "source-hidden" : "native solid", bounds = c.GetBox(false, false) });
        }
        foreach (string name in hidden) if (!matched.Contains(name)) throw new Exception("Unmatched hidden component " + name);
        foreach (string name in translucent) if (!matched.Contains(name)) throw new Exception("Unmatched translucent component " + name);
        doc.GraphicsRedraw2(); return Json(rows);
    }
    public static string Orient(object app, string path, double[] rotation) {
        if (rotation.Length != 9) throw new Exception("Supply a CAD-to-view 3x3 matrix");
        double[] transform = new double[16]; Array.Copy(rotation, transform, 9); transform[12] = 1;
        var doc = D(app, path); var util = (MathUtility)S(app).GetMathUtility();
        ((ModelView)doc.ActiveView).Orientation3 = (MathTransform)util.CreateTransform(transform);
        doc.ViewZoomtofit2(); doc.GraphicsRedraw2();
        return View(app, path);
    }
    public static string View(object app, string path) {
        var view = (ModelView)D(app, path).ActiveView;
        return Json(new { orientation = view.Orientation3.ArrayData, translation = view.Translation3.ArrayData, scale = view.Scale2, displayMode = view.DisplayMode });
    }
    public static void Bmp(object app, string path, string output, int size, bool white) {
        S(app).SetUserPreferenceIntegerValue((int)swUserPreferenceIntegerValue_e.swColorsBackgroundAppearance, 0);
        S(app).SetUserPreferenceIntegerValue((int)swUserPreferenceIntegerValue_e.swSystemColorsViewportBackground, white ? 0xffffff : 0);
        var doc = D(app, path); doc.GraphicsRedraw2();
        if (!doc.SaveBMP(output, size, size)) throw new Exception("Native BMP capture failed " + output);
    }
    public static void RestoreView(object app, string path) {
        var doc = D(app, path); if (doc == null || originalToggles == null) return;
        var util = (MathUtility)S(app).GetMathUtility(); var view = (ModelView)doc.ActiveView;
        view.Orientation3 = (MathTransform)util.CreateTransform(originalOrientation);
        view.Translation3 = (MathVector)util.CreateVector(originalTranslation);
        view.Scale2 = originalScale; view.DisplayMode = originalMode;
        foreach (var toggle in originalToggles) doc.SetUserPreferenceToggle(toggle.Key, toggle.Value);
        var scene = (SWScene)((Configuration)doc.GetActiveConfiguration()).GetScene();
        if (scene != null) { scene.FloorShadows = originalFloorShadows; scene.FloorReflections = originalFloorReflections; }
        originalToggles = null;
    }
}
