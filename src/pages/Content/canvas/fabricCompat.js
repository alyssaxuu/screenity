// Fabric v5 → v6+ shim. v6 dropped the `fabric` namespace export, so
// this re-exports modern Fabric's named exports under the legacy `fabric.X` shape
// our call sites use.
//
// Only the names the canvas modules actually reference: webpack follows the
// namespace object below, so re-exporting the rest of v6 "just in case" pinned
// SVG parsing, image filters, and unused shape classes into the content bundle
// that's injected into every page. Add a name back if a call site needs it.
import {
  Canvas,
  Circle,
  Color,
  Control,
  FabricImage,
  FabricObject,
  Group,
  Line,
  Path,
  PencilBrush,
  Rect,
  Textbox,
  Triangle,
  controlsUtils,
  util,
} from "fabric";

// v5-style namespace; only the classes used in src/pages/Content/canvas.
// Undo/redo goes through canvas.loadFromJSON, which resolves serialized type
// names via fabric's own class registry: classes register on import, so every
// shape we can create is already covered by the imports above.
export const fabric = {
  Canvas,
  Circle,
  Color,
  Control,
  Group,
  Image: FabricImage,
  Line,
  Object: FabricObject,
  Path,
  PencilBrush,
  Rect,
  Textbox,
  Triangle,
  controlsUtils,
  util,
};

export default fabric;
