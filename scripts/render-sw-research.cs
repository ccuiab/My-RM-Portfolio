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
    public static int DocumentCount(object app) { var docs = S(app).GetDocuments() as object[]; return docs == null ? 0 : docs.Length; }
    public static void Exit(object app) { S(app).ExitApp(); }
    public static Dictionary<string, bool> GlobalPreferences(object app) {
        return new Dictionary<string, bool> {
            { "autoSave", S(app).GetUserPreferenceToggle((int)swUserPreferenceToggle_e.swAutoSaveEnable) },
            { "backup", S(app).GetUserPreferenceToggle((int)swUserPreferenceToggle_e.swBackupEnable) },
            { "backgroundControl", S(app).UserControlBackground },
            { "swDisplayShadowsInShadedMode", S(app).GetUserPreferenceToggle((int)swUserPreferenceToggle_e.swDisplayShadowsInShadedMode) },
            { "swDisplayAmbientOcclusionShadows", S(app).GetUserPreferenceToggle((int)swUserPreferenceToggle_e.swDisplayAmbientOcclusionShadows) },
            { "swDisplayRealViewGraphics", S(app).GetUserPreferenceToggle((int)swUserPreferenceToggle_e.swDisplayRealViewGraphics) }
        };
    }
    public static void DisableAutomaticWrites(object app) {
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swAutoSaveEnable, false);
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swBackupEnable, false);
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swDisplayShadowsInShadedMode, false);
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swDisplayAmbientOcclusionShadows, false);
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swDisplayRealViewGraphics, false);
    }
    public static void RestoreGlobalPreferences(object app, Dictionary<string, bool> old) {
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swAutoSaveEnable, old["autoSave"]);
        S(app).SetUserPreferenceToggle((int)swUserPreferenceToggle_e.swBackupEnable, old["backup"]);
        // Keep the isolated automation server alive until ExitApp; this flag is session-only.
        foreach (var row in old) if (row.Key.StartsWith("sw", StringComparison.Ordinal)) S(app).SetUserPreferenceToggle((int)Enum.Parse(typeof(swUserPreferenceToggle_e), row.Key), row.Value);
    }
    static ModelDoc2 D(object app, string path) { return (ModelDoc2)S(app).GetOpenDocumentByName(path); }
    public static void RestoreFrameKeepingServerAlive(object app, Dictionary<string, int> frame) {
        S(app).Visible = true; S(app).FrameState = 0;
        S(app).FrameWidth = frame["width"]; S(app).FrameHeight = frame["height"];
        S(app).FrameState = frame["state"];
    }
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
    public static string LauncherComponents(object app, string path, string[] hidden, string[] translucent, string[] solid) {
        var doc = D(app, path); var rows = new List<object>();
        var hide = new HashSet<string>(hidden); var fade = new HashSet<string>(translucent);
        var keep = new HashSet<string>(solid);
        keep.Remove("Friction_wheel"); keep.Remove("smallFriction_wheel");
        keep.Add("Friction_wheel-1"); keep.Add("Friction_wheel-3"); keep.Add("smallFriction_wheel-1");
        foreach (string name in translucent) keep.Add(name);
        var all = (object[])((AssemblyDoc)doc).GetComponents(false);
        var view = (ModelView)doc.ActiveView; var tree = doc.FeatureManager;
        bool graphics = view.EnableGraphicsUpdate, featureTree = tree.EnableFeatureTree, treeWindow = tree.EnableFeatureTreeWindow;
        var matched = new HashSet<string>();
        try {
            view.EnableGraphicsUpdate = false; tree.EnableFeatureTree = false; tree.EnableFeatureTreeWindow = false;
            foreach (object item in all) {
                var c = (Component2)item; string name = c.Name2;
                bool retained = keep.Contains(name);
                foreach (string k in keep) if (name.StartsWith(k + "/", StringComparison.Ordinal) || k.StartsWith(name + "/", StringComparison.Ordinal)) { retained = true; break; }
                if (hide.Contains(name)) { retained = false; matched.Add(name); }
                c.Visible = retained ? 1 : 0;
                if (fade.Contains(name)) matched.Add(name);
                rows.Add(new { name, action = !retained ? "hidden" : fade.Contains(name) ? "translucent" : "native solid" });
            }
            doc.ClearSelection2(true);
            foreach (object item in all) {
                var c = (Component2)item;
                if (fade.Contains(c.Name2) && !c.Select4(true, null, false)) throw new Exception("Cannot select transparent plate " + c.Name2);
            }
            if (!((AssemblyDoc)doc).SetComponentTransparent(true)) throw new Exception("Native component transparency did not activate");
            doc.ClearSelection2(true);
            foreach (object item in all) {
                var c = (Component2)item; string name = c.Name2;
                if (!fade.Contains(name)) continue;
                double[] values = c.GetMaterialPropertyValues2((int)swInConfigurationOpts_e.swThisConfiguration, null) as double[];
                if (values == null || values.Length < 9 || values[0] < 0) values = c.GetModelMaterialPropertyValues(c.ReferencedConfiguration) as double[];
                if (values == null || values.Length < 9 || values[0] < 0) throw new Exception("Cannot preserve native material while fading " + name);
                double[] old = (double[])values.Clone(); values[7] = .82;
                c.SetMaterialPropertyValues2(values, (int)swInConfigurationOpts_e.swThisConfiguration, null);
                rows.Add(new { name, action = "opacity 0.18", originalMaterial = old, captureMaterial = values });
            }
        } finally {
            view.EnableGraphicsUpdate = graphics; tree.EnableFeatureTree = featureTree; tree.EnableFeatureTreeWindow = treeWindow;
        }
        foreach (string name in hidden) if (!matched.Contains(name)) throw new Exception("Unmatched hidden component " + name);
        foreach (string name in translucent) if (!matched.Contains(name)) throw new Exception("Unmatched translucent component " + name);
        doc.Extension.UpdateRenderMaterialsInSceneGraph(true);
        doc.GraphicsRedraw2(); return Json(rows);
    }
    public static string ValidateLauncher(object app, string path) {
        var doc = D(app, path); var rows = new List<object>();
        var required = new HashSet<string>(new [] { "Friction_wheel-1", "Friction_wheel-3", "smallFriction_wheel-1", "4mm_发机主下板-1", "枪管-1", "RM_裁判系统测速模块_SM11_2019-1" });
        foreach (object item in (object[])((AssemblyDoc)doc).GetComponents(false)) {
            var c = (Component2)item;
            if (!required.Remove(c.Name2)) continue;
            if (c.GetModelDoc2() == null || c.IsHidden(false)) throw new Exception("Required launcher component unavailable: " + c.Name2);
            rows.Add(new { name = c.Name2, bounds = c.GetBox(false, false), transform = c.Transform2.ArrayData });
        }
        if (required.Count != 0) throw new Exception("Required launcher components not found: " + string.Join(", ", required));
        return Json(rows);
    }
    public static string ReadOnlyDocuments(object app) {
        var rows = new List<object>();
        foreach (object item in (object[])S(app).GetDocuments()) {
            var doc = (ModelDoc2)item;
            if (!doc.IsOpenedReadOnly()) throw new Exception("Referenced document is writable: " + doc.GetPathName());
            rows.Add(new { path = doc.GetPathName(), readOnly = true, dirty = doc.GetSaveFlag() });
        }
        return Json(rows);
    }
    public static void OpaqueCaptures(object app, string path, string[] translucent, string directory, int size) {
        var doc = D(app, path); var names = new HashSet<string>(translucent);
        var components = new List<Component2>(); var visibility = new List<int>();
        var view = (ModelView)doc.ActiveView; bool graphics = view.EnableGraphicsUpdate;
        try {
            view.EnableGraphicsUpdate = false;
            foreach (object item in (object[])((AssemblyDoc)doc).GetComponents(false)) {
                var c = (Component2)item;
                if (!names.Contains(c.Name2)) continue;
                components.Add(c); visibility.Add(c.Visible); c.Visible = 0;
            }
            view.EnableGraphicsUpdate = graphics;
            Bmp(app, path, System.IO.Path.Combine(directory, "launcher-opaque-white.bmp"), size, true);
            Bmp(app, path, System.IO.Path.Combine(directory, "launcher-opaque-black.bmp"), size, false);
        } finally {
            view.EnableGraphicsUpdate = false;
            for (int i = 0; i < components.Count; i++) components[i].Visible = visibility[i];
            view.EnableGraphicsUpdate = graphics;
            doc.GraphicsRedraw2();
        }
    }
    public static string Orient(object app, string path, double[] rotation) {
        if (rotation.Length != 9) throw new Exception("Supply a CAD-to-view 3x3 matrix");
        double[] transform = new double[16]; Array.Copy(rotation, transform, 9); transform[12] = 1;
        var doc = D(app, path); var util = (MathUtility)S(app).GetMathUtility();
        ((ModelView)doc.ActiveView).Orientation3 = (MathTransform)util.CreateTransform(transform);
        var core = new HashSet<string>(new [] { "Friction_wheel-1", "Friction_wheel-3", "smallFriction_wheel-1", "4mm_发机主下板-1", "枪管-1", "RM_裁判系统测速模块_SM11_2019-1" });
        doc.ClearSelection2(true);
        if (path.EndsWith("发机_4310pitch.SLDASM", StringComparison.OrdinalIgnoreCase)) {
            foreach (object item in (object[])((AssemblyDoc)doc).GetComponents(false)) {
                var c = (Component2)item;
                if (core.Contains(c.Name2) && !c.Select4(true, null, false)) throw new Exception("Cannot select core for framing " + c.Name2);
            }
            doc.ViewZoomToSelection();
        } else doc.ViewZoomtofit2();
        doc.ClearSelection2(true);
        ((ModelView)doc.ActiveView).Scale2 *= .8; doc.GraphicsRedraw2();
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
